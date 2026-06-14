"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminPage() {
  const [calendarName, setCalendarName] = useState("");
  const [calendarDesc, setCalendarDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [calendars, setCalendars] = useState<any[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [maxUses, setMaxUses] = useState(999);

  const supabase = createClient();

  useEffect(() => {
    loadCalendars();
  }, []);

  const loadCalendars = async () => {
    const { data } = await supabase.from("calendars").select("*");
    if (data) setCalendars(data);
  };

  const createCalendar = async () => {
    if (!calendarName) return;

    const { data, error } = await supabase
      .from("calendars")
      .insert({ name: calendarName, description: calendarDesc, color: "#6366f1" })
      .select()
      .single();

    if (!error && data) {
      setCalendarName("");
      setCalendarDesc("");
      setShowCreateForm(false);
      loadCalendars();
    }
  };

  const generateInviteCode = async () => {
    if (!selectedCalendarId) return;

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30天后过期

    const { data, error } = await supabase
      .from("invite_codes")
      .insert({
        code,
        calendar_id: selectedCalendarId,
        max_uses: maxUses,
        use_count: 0,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      setInviteCode(code);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-8">🌳 麦麦的时间树 · 管理</h1>

        {/* 创建日历 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">日历管理</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="text-sm text-indigo-600 hover:underline"
            >
              {showCreateForm ? "取消" : "+ 新建日历"}
            </button>
          </div>

          {showCreateForm && (
            <div className="space-y-3 mb-4 p-4 bg-gray-50 rounded-lg">
              <input
                type="text"
                value={calendarName}
                onChange={(e) => setCalendarName(e.target.value)}
                placeholder="日历名称（如：研发团队）"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <input
                type="text"
                value={calendarDesc}
                onChange={(e) => setCalendarDesc(e.target.value)}
                placeholder="描述（可选）"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                onClick={createCalendar}
                disabled={!calendarName}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          )}

          {calendars.length > 0 ? (
            <div className="space-y-2">
              {calendars.map((cal) => (
                <div
                  key={cal.id}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedCalendarId === cal.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSelectedCalendarId(cal.id)}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cal.color }}
                    />
                    <span className="font-medium">{cal.name}</span>
                    <span className="text-sm text-gray-400">
                      {cal.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">还没有日历，先创建一个吧</p>
          )}
        </div>

        {/* 生成邀请码 */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h2 className="font-semibold mb-4">📨 生成邀请码</h2>

          {!selectedCalendarId ? (
            <p className="text-gray-400 text-sm">请先选择一个日历</p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-1">最大使用次数</label>
                <input
                  type="number"
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  min={1}
                  max={9999}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">默认 999（几乎不限）</p>
              </div>
              <button
                onClick={generateInviteCode}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                生成新邀请码
              </button>

              {inviteCode && (
                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600 mb-2">
                    邀请码（30天有效）：
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-mono font-bold tracking-[0.3em] text-green-700">
                      {inviteCode}
                    </span>
                    <button
                      onClick={copyCode}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      复制
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    把这个邀请码发给团队成员，他们输入邀请码即可加入日历
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 历史邀请码 */}
        {selectedCalendarId && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold mb-4">📋 已生成的邀请码</h2>
            <InviteCodeList calendarId={selectedCalendarId} />
          </div>
        )}
      </div>
    </div>
  );
}

function InviteCodeList({ calendarId }: { calendarId: string }) {
  const [codes, setCodes] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadCodes();
  }, [calendarId]);

  const loadCodes = async () => {
    const { data } = await supabase
      .from("invite_codes")
      .select("*, members!invite_codes_used_by_fkey(nickname)")
      .eq("calendar_id", calendarId)
      .order("created_at", { ascending: false });

    if (data) setCodes(data);
  };

  if (codes.length === 0) {
    return <p className="text-gray-400 text-sm">还没有生成过邀请码</p>;
  }

  return (
    <div className="space-y-2">
      {codes.map((code) => (
        <div key={code.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div>
            <span className="font-mono font-bold tracking-wider">{code.code}</span>
            <span className="text-xs text-gray-400 ml-2">
              {code.used_by ? (
                <span className="text-green-500">
                  已被 {code.members?.nickname || "某人"} 使用
                </span>
              ) : (
                <span className="text-yellow-500">
                  未使用 · {new Date(code.expires_at).toLocaleDateString("zh-CN")} 过期
                </span>
              )}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {new Date(code.created_at).toLocaleDateString("zh-CN")}
          </span>
        </div>
      ))}
    </div>
  );
}

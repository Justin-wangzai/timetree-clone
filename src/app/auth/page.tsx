"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoin = async () => {
    if (loading || !code || !nickname) return;

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      // 查邀请码：未过期
      const { data: invite, error: inviteError } = await supabase
        .from("invite_codes")
        .select("*, calendars(*)")
        .eq("code", code.trim().toUpperCase())
        .gte("expires_at", new Date().toISOString())
        .single();

      if (inviteError || !invite) {
        setError("邀请码无效或已过期");
        setLoading(false);
        return;
      }

      // 检查使用次数
      if (invite.use_count >= invite.max_uses) {
        setError("邀请码已达到使用上限");
        setLoading(false);
        return;
      }

      // 生成匿名用户 ID (存在 localStorage)
      const userId = crypto.randomUUID();
      localStorage.setItem("tt_user_id", userId);
      localStorage.setItem("tt_nickname", nickname);

      // 添加为成员
      const { error: memberError } = await supabase
        .from("members")
        .insert({
          calendar_id: invite.calendar_id,
          user_id: userId,
          nickname: nickname,
          role: "editor",
        });

      if (memberError) {
        setError("加入失败，请重试");
        setLoading(false);
        return;
      }

      // 增加使用次数
      await supabase
        .from("invite_codes")
        .update({ use_count: invite.use_count + 1 })
        .eq("id", invite.id);

      // 存入 session
      document.cookie = `tt_user_id=${userId}; path=/; max-age=${60 * 60 * 24 * 30}`;
      document.cookie = `tt_nickname=${encodeURIComponent(nickname)}; path=/; max-age=${60 * 60 * 24 * 30}`;

      router.push("/calendar");
    } catch (e) {
      setError("出错了，请重试");
    } finally {
      setLoading(false);
    }
  };

  const btnDisabled = loading || !code || !nickname;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">🌳 麦麦的时间树</h1>
          <p className="text-gray-500 mt-2">共享日历</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              你的昵称
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="输入你的名字"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
              maxLength={20}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              邀请码
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="输入邀请码"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none uppercase tracking-widest text-gray-900"
              maxLength={8}
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <div
            onClick={btnDisabled ? undefined : handleJoin}
            onTouchEnd={(e) => {
              e.preventDefault();
              if (!btnDisabled) handleJoin();
            }}
            style={{
              WebkitTapHighlightColor: "transparent",
              opacity: btnDisabled ? 0.5 : 1,
            }}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 active:bg-indigo-800 transition-colors text-lg text-center cursor-pointer select-none"
          >
            {loading ? "加入中..." : "🌳 加入时间树"}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          麦麦的时间树 · 共享日历
        </p>
      </div>
    </div>
  );
}

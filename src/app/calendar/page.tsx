"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Calendar, momentLocalizer, Views } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { createClient } from "@/lib/supabase/client";
import type { CalendarEvent, Calendar as CalendarType } from "@/lib/supabase/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

const localizer = momentLocalizer(moment);

// 配置 moment 中文
moment.locale("zh-cn", {
  weekdays: "周日_周一_周二_周三_周四_周五_周六".split("_"),
  weekdaysShort: "周日_周一_周二_周三_周四_周五_周六".split("_"),
  months: "一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月".split("_"),
  meridiem: (h: number) => (h < 12 ? "上午" : "下午"),
  week: { dow: 1 }, // 周一为每周第一天
});

// react-big-calendar 中文 messages
const messages = {
  date: "日期",
  time: "时间",
  event: "事件",
  allDay: "全天",
  week: "周",
  work_week: "工作周",
  day: "日",
  month: "月",
  previous: "上",
  next: "下",
  yesterday: "昨天",
  tomorrow: "明天",
  today: "今天",
  agenda: "列表",
  noEventsInRange: "该时段没有事件",
  showMore: (total: number) => `还有 ${total} 个`,
};

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendar, setCalendar] = useState<CalendarType | null>(null);
  const [nickname, setNickname] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 获取当前用户
  const getUserId = useCallback(() => {
    if (typeof document === "undefined") return null;
    const match = document.cookie.match(/tt_user_id=([^;]+)/);
    return match ? match[1] : localStorage.getItem("tt_user_id") || null;
  }, []);

  const getUserNickname = useCallback(() => {
    if (typeof document === "undefined") return "";
    const match = document.cookie.match(/tt_nickname=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : localStorage.getItem("tt_nickname") || "";
  }, []);

  // 加载日历数据
  const loadData = useCallback(async () => {
    const userId = getUserId();
    if (!userId) {
      router.push("/auth");
      return;
    }

    setNickname(getUserNickname());
    const supabase = createClient();

    // 查询用户所在的日历
    const { data: membership } = await supabase
      .from("members")
      .select("calendar_id")
      .eq("user_id", userId)
      .single();

    if (!membership) {
      router.push("/auth");
      return;
    }

    // 获取日历信息
    const { data: cal } = await supabase
      .from("calendars")
      .select("*")
      .eq("id", membership.calendar_id)
      .single();

    if (cal) setCalendar(cal);

    // 获取事件
    const { data: evts } = await supabase
      .from("events")
      .select("*")
      .eq("calendar_id", membership.calendar_id)
      .order("start_time", { ascending: true });

    if (evts) setEvents(evts);
  }, [router, getUserId, getUserNickname]);

  // 单独处理实时订阅（避免重复 subscribe）
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const userId = getUserId();
      if (!userId) return;

      const { data: membership } = await supabase
        .from("members")
        .select("calendar_id")
        .eq("user_id", userId)
        .single();

      if (!membership || cancelled) return;

      // 清除旧 channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel("events-changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "events",
            filter: `calendar_id=eq.${membership.calendar_id}`,
          },
          (payload) => {
            if (payload.eventType === "INSERT") {
              setEvents((prev) => [...prev, payload.new as CalendarEvent]);
            } else if (payload.eventType === "UPDATE") {
              setEvents((prev) =>
                prev.map((e) =>
                  e.id === payload.new.id ? (payload.new as CalendarEvent) : e
                )
              );
            } else if (payload.eventType === "DELETE") {
              setEvents((prev) =>
                prev.filter((e) => e.id !== payload.old.id)
              );
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [getUserId]);

  // 初始加载
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 格式化事件用于日历显示
  const calendarEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: new Date(e.start_time),
    end: new Date(e.end_time),
    allDay: e.all_day,
    resource: e,
  }));

  // 打开添加/编辑弹窗
  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    setEditingEvent({
      title: "",
      description: "",
      start_time: slotInfo.start.toISOString(),
      end_time: slotInfo.end.toISOString(),
      all_day: false,
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event: any) => {
    const e = event.resource;
    setEditingEvent({
      id: e.id,
      title: e.title,
      description: e.description,
      start_time: e.start_time,
      end_time: e.end_time,
      all_day: e.all_day,
    });
    setShowModal(true);
  };

  // 保存事件
  const handleSave = async () => {
    if (!editingEvent?.title || !calendar) return;

    const supabase = createClient();
    const userId = getUserId();

    if (editingEvent.id) {
      // 更新
      await supabase
        .from("events")
        .update({
          title: editingEvent.title,
          description: editingEvent.description,
          start_time: editingEvent.start_time,
          end_time: editingEvent.end_time,
          all_day: editingEvent.all_day,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingEvent.id);
    } else {
      // 新增
      await supabase.from("events").insert({
        calendar_id: calendar.id,
        title: editingEvent.title,
        description: editingEvent.description || "",
        start_time: editingEvent.start_time,
        end_time: editingEvent.end_time,
        all_day: editingEvent.all_day || false,
        created_by: userId,
      });
    }

    setShowModal(false);
    setEditingEvent(null);
  };

  // 删除事件
  const handleDelete = async () => {
    if (!editingEvent?.id) return;
    const supabase = createClient();
    await supabase.from("events").delete().eq("id", editingEvent.id);
    setShowModal(false);
    setEditingEvent(null);
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 顶部栏 */}
      <header className="flex items-center justify-between px-6 py-3 border-b bg-white z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-indigo-600">
            📅 {calendar?.name || "加载中..."}
          </h1>
          {calendar?.description && (
            <span className="text-sm text-gray-400 hidden md:inline">
              {calendar.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            👤 {nickname}
          </span>
          <button
            onClick={() => router.push("/auth")}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            退出
          </button>
        </div>
      </header>

      {/* 日历主体 */}
      <div className="flex-1 p-4">
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          views={["month", "week", "day", "agenda"]}
          defaultView={Views.MONTH}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          popup
          messages={messages}
          eventPropGetter={() => ({
            style: {
              backgroundColor: calendar?.color || "#6366f1",
              borderRadius: "6px",
              border: "none",
              fontSize: "13px",
            },
          })}
        />
      </div>

      {/* 手机端底部浮动添加按钮 */}
      <button
        onClick={() =>
          handleSelectSlot({
            start: new Date(),
            end: new Date(Date.now() + 3600000),
          })
        }
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-indigo-700 active:scale-95 transition z-40 md:hidden"
      >
        +
      </button>

      {/* 事件弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingEvent?.id ? "编辑事件" : "新建事件"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">标题</label>
                <input
                  type="text"
                  value={editingEvent?.title || ""}
                  onChange={(e) =>
                    setEditingEvent((prev) => ({ ...prev!, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="事件标题"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">开始时间</label>
                  <input
                    type="datetime-local"
                    value={
                      editingEvent?.start_time
                        ? moment(editingEvent.start_time).format("YYYY-MM-DDTHH:mm")
                        : ""
                    }
                    onChange={(e) =>
                      setEditingEvent((prev) => ({
                        ...prev!,
                        start_time: new Date(e.target.value).toISOString(),
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">结束时间</label>
                  <input
                    type="datetime-local"
                    value={
                      editingEvent?.end_time
                        ? moment(editingEvent.end_time).format("YYYY-MM-DDTHH:mm")
                        : ""
                    }
                    onChange={(e) =>
                      setEditingEvent((prev) => ({
                        ...prev!,
                        end_time: new Date(e.target.value).toISOString(),
                      }))
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">备注</label>
                <textarea
                  value={editingEvent?.description || ""}
                  onChange={(e) =>
                    setEditingEvent((prev) => ({
                      ...prev!,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                  rows={3}
                  placeholder="添加备注..."
                />
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <div>
                {editingEvent?.id && (
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm"
                  >
                    删除
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingEvent(null);
                  }}
                  className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editingEvent?.title}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

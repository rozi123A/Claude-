import { useState, useEffect } from "react";
  import { trpc } from "@/lib/trpc";
  import { useToast } from "@/hooks/use-toast";

  interface UserData { telegramId: number; balance: number; initData: string; }
  interface TasksSectionProps { user: UserData; lang: string; onReward: (u: Partial<UserData>) => void; }

  export default function TasksSection({ user, lang, onReward }: TasksSectionProps) {
    const { toast } = useToast();
    const [claiming, setClaiming] = useState<number | null>(null);
    const isAr = lang !== "en";

    const { data, refetch, isLoading } = trpc.tasks.list.useQuery(
      { telegramId: user.telegramId, initData: user.initData },
      { refetchOnWindowFocus: false }
    );

    const recheckMut = trpc.tasks.recheck.useMutation();
    const claimMut = trpc.tasks.claim.useMutation();

    // Re-check membership when tab opens (detect leaves)
    useEffect(() => {
      if (!user.initData) return;
      recheckMut.mutate(
        { telegramId: user.telegramId, initData: user.initData },
        {
          onSuccess: (res) => {
            if (res.deducted > 0) {
              toast({
                title: isAr ? "⚠️ تم خصم نقاط" : "⚠️ Points Deducted",
                description: isAr
                  ? `غادرت ${res.left?.join(", ")} — خُصم منك ${res.deducted} نقطة`
                  : `Left ${res.left?.join(", ")} — ${res.deducted} pts deducted`,
                variant: "destructive",
              });
              onReward({ balance: user.balance - res.deducted });
              refetch();
            }
          },
        }
      );
    }, []);

    const handleClaim = async (taskId: number, channelUsername: string) => {
      setClaiming(taskId);
      claimMut.mutate(
        { telegramId: user.telegramId, initData: user.initData, taskId },
        {
          onSuccess: (res) => {
            setClaiming(null);
            if (res.success) {
              toast({ title: isAr ? "🎉 مبروك!" : "🎉 Congrats!", description: res.message });
              onReward({ balance: user.balance + (res.points ?? 0) });
              refetch();
            } else {
              toast({ title: isAr ? "تنبيه" : "Notice", description: res.message, variant: "destructive" });
            }
          },
          onError: () => {
            setClaiming(null);
            toast({ title: isAr ? "خطأ" : "Error", description: isAr ? "حاول مجدداً" : "Try again", variant: "destructive" });
          },
        }
      );
    };

    const openAndClaim = (task: any) => {
      const username = task.channelUsername.replace('@', '');
      const url = task.type === 'bot' ? `https://t.me/${username}` : `https://t.me/${username}`;
      window.open(url, '_blank');
      setTimeout(() => handleClaim(task.id, task.channelUsername), 3000);
    };

    const tasks = data?.tasks ?? [];

    return (
      <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>
            {isAr ? "المهام" : "Tasks"}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6 }}>
            {isAr ? "انضم للقنوات واربح نقاط عشوائية" : "Join channels & earn random points"}
          </p>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.4)", paddingTop: 40 }}>
            {isAr ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "40px 20px",
            background: "rgba(255,255,255,0.05)", borderRadius: 16,
            color: "rgba(255,255,255,0.4)", fontSize: 14,
          }}>
            {isAr ? "لا توجد مهام متاحة حالياً" : "No tasks available yet"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tasks.map((task: any) => (
              <div key={task.id} style={{
                background: task.completed
                  ? "rgba(16,185,129,0.08)"
                  : "rgba(255,255,255,0.05)",
                border: task.completed
                  ? "1px solid rgba(16,185,129,0.3)"
                  : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "16px",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                {/* Icon */}
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: task.type === "bot" ? "rgba(99,102,241,0.2)" : "rgba(59,130,246,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
                }}>
                  {task.type === "bot" ? "🤖" : "📢"}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 2 }}>
                    {task.name}
                  </div>
                  {task.description && (
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginBottom: 4 }}>
                      {task.description}
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {task.completed ? (
                      <span style={{ color: "#10B981", fontSize: 12, fontWeight: 600 }}>
                        ✅ +{task.pointsEarned} {isAr ? "نقطة" : "pts"}
                      </span>
                    ) : (
                      <span style={{
                        background: "rgba(251,191,36,0.15)", color: "#FBB724",
                        borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                      }}>
                        {task.pointsMin === task.pointsMax
                          ? `+${task.pointsMin}`
                          : `+${task.pointsMin}-${task.pointsMax}`} {isAr ? "نقطة" : "pts"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Button */}
                {task.completed ? (
                  <div style={{ color: "#10B981", fontSize: 22 }}>✓</div>
                ) : (
                  <button
                    disabled={claiming === task.id}
                    onClick={() => openAndClaim(task)}
                    style={{
                      background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
                      color: "#fff", border: "none", borderRadius: 12,
                      padding: "10px 16px", fontWeight: 700, fontSize: 13,
                      cursor: claiming === task.id ? "not-allowed" : "pointer",
                      opacity: claiming === task.id ? 0.6 : 1,
                      whiteSpace: "nowrap", flexShrink: 0,
                    }}
                  >
                    {claiming === task.id
                      ? (isAr ? "⏳" : "⏳")
                      : (isAr ? "انضم ✓" : "Join ✓")}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        <div style={{
          marginTop: 20, padding: "12px 16px",
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 12, fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center",
        }}>
          ⚠️ {isAr
            ? "إذا غادرت القناة ستُخصم نقاطك تلقائياً"
            : "Leaving the channel will deduct your points automatically"}
        </div>
      </div>
    );
  }
  
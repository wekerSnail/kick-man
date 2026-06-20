"use client";

interface ShortcutGroup {
  title: string;
  icon: string;
  shortcuts: { key: string; desc: string; alt?: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "移动",
    icon: "🕹️",
    shortcuts: [
      { key: "W", desc: "向前移动（朝向老板方向）" },
      { key: "A", desc: "向左移动" },
      { key: "S", desc: "向后移动" },
      { key: "D", desc: "向右移动" },
    ],
  },
  {
    title: "攻击",
    icon: "🦵",
    shortcuts: [
      { key: "左键", desc: "踹击 / 挥砍武器", alt: "无武器时踹击，有武器时挥砍" },
      { key: "右键长按", desc: "蓄力投掷武器", alt: "仅狼牙棒/棒球棒可投掷" },
    ],
  },
  {
    title: "道具",
    icon: "🎒",
    shortcuts: [
      { key: "1-6", desc: "使用/装备对应格道具" },
      { key: "E", desc: "拾取附近道具" },
    ],
  },
  {
    title: "系统",
    icon: "⚙️",
    shortcuts: [
      { key: "ESC", desc: "暂停/继续游戏" },
      { key: "M", desc: "切换音效开关" },
      { key: "?", desc: "显示/隐藏快捷键帮助" },
    ],
  },
];

export function KeyboardHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md text-white animate-[fadein_0.2s_ease-out]">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-amber-400/30 rounded-3xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-2xl font-black flex items-center gap-2 bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
            <span>⌨️</span>
            <span>键盘快捷键</span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div
              key={group.title}
              className="bg-black/40 rounded-xl p-3 border border-white/5"
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-lg">{group.icon}</span>
                <span className="text-sm font-bold text-amber-200">{group.title}</span>
              </div>
              <div className="space-y-2">
                {group.shortcuts.map((s) => (
                  <div key={s.key} className="text-xs">
                    <div className="flex items-center gap-2">
                      <kbd className="inline-block min-w-[2rem] px-2 py-0.5 bg-white/10 border border-white/20 rounded text-center font-mono font-bold text-white text-[11px]">
                        {s.key}
                      </kbd>
                      <span className="text-white/80">{s.desc}</span>
                    </div>
                    {s.alt && (
                      <div className="text-[10px] text-white/40 ml-1 mt-0.5">{s.alt}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-3 mb-4">
          <div className="text-[10px] uppercase tracking-wider text-amber-300/70 mb-1.5">
            💡 潜行小贴士
          </div>
          <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
            <li>老板地面有半透明扇形检测区，避开它</li>
            <li>蹲盆栽/书架/沙发旁可隐藏（状态显示"隐藏中"）</li>
            <li>被老板"回头看"时立即静止或躲藏</li>
            <li>使用隐身药水可免疫所有检测 5 秒</li>
            <li>键盘盾被发现时只扣 0.5 血（而非 1 血）</li>
            <li>老板开会时攻击会被格挡，武器被消耗！</li>
          </ul>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-gray-900 font-bold hover:scale-[1.02] transition-transform shadow-lg"
        >
          ✅ 知道了
        </button>
        <p className="text-white/30 text-[10px] mt-3 text-center">
          按 ? 键可随时打开/关闭此帮助 · 也可在主菜单"查看玩法说明"查看
        </p>
      </div>
    </div>
  );
}

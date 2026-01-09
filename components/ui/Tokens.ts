
// Design Tokens for consistent UI
export const TOKENS = {
  // Typography
  TEXT: {
    // Headlines
    DISPLAY: "text-4xl font-black tracking-tight text-slate-900 dark:text-white leading-none",
    HEADING: "text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight",
    SUBHEADING: "text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug",
    
    // Body & Labels
    SECTION_LABEL: "text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]",
    BODY: "text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed",
    BODY_SM: "text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed",
    CAPTION: "text-xs font-semibold text-slate-400 dark:text-slate-500",
  },
  
  // Containers
  CARD: {
    BASE: "bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-sm dark:shadow-none overflow-hidden transition-all duration-300",
    HOVER: "hover:shadow-md hover:border-blue-300/50 dark:hover:border-blue-700/50 hover:-translate-y-0.5",
  },

  // Interactive
  BUTTON: {
    BASE: "inline-flex items-center justify-center font-bold rounded-xl transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-slate-900 select-none [:root[data-density=compact]_&]:rounded-lg",
    SIZE: {
      SM: "px-3 h-9 text-sm gap-1.5 [:root[data-density=compact]_&]:h-8 [:root[data-density=compact]_&]:px-2.5",
      MD: "px-5 h-11 text-[15px] gap-2 [:root[data-density=compact]_&]:h-9 [:root[data-density=compact]_&]:px-3 [:root[data-density=compact]_&]:text-sm",
      LG: "px-6 h-14 text-lg gap-2.5 [:root[data-density=compact]_&]:h-11 [:root[data-density=compact]_&]:px-4 [:root[data-density=compact]_&]:text-base",
      ICON: "size-11 p-0 [:root[data-density=compact]_&]:size-9", 
    },
    VARIANT: {
      PRIMARY: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 focus:ring-blue-500",
      SECONDARY: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 focus:ring-slate-400 shadow-sm",
      GHOST: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 focus:ring-slate-400",
      DANGER: "bg-red-50 dark:bg-red-900/10 text-red-600 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/30 focus:ring-red-500",
      OUTLINE: "bg-transparent border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 focus:ring-blue-500",
    }
  },

  // Form
  INPUT: {
    BASE: "w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-[15px] font-semibold transition-all outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-normal disabled:opacity-60 disabled:cursor-not-allowed [:root[data-density=compact]_&]:rounded-lg [:root[data-density=compact]_&]:text-sm",
    FOCUS: "focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:focus:ring-blue-500/20",
    SIZE: {
      MD: "px-4 h-11 [:root[data-density=compact]_&]:h-9 [:root[data-density=compact]_&]:px-3",
    }
  },

  // Badge - Scaled up
  BADGE: {
    BASE: "inline-flex items-center justify-center rounded-full font-bold uppercase tracking-wider whitespace-nowrap ring-1 ring-inset",
    SIZE: {
      SM: "px-2.5 py-0.5 text-xs [:root[data-density=compact]_&]:text-[10px] [:root[data-density=compact]_&]:px-2 [:root[data-density=compact]_&]:py-0",
      MD: "px-3 py-1 text-sm [:root[data-density=compact]_&]:text-xs [:root[data-density=compact]_&]:px-2.5 [:root[data-density=compact]_&]:py-0.5",
    },
    VARIANT: {
      SUCCESS: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
      WARNING: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30",
      DANGER: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-400 dark:ring-rose-500/30",
      INFO: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30",
      NEUTRAL: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-500/40",
    }
  },

  // Table
  TABLE: {
    HEADER: "bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-header",
    HEADER_CELL: "px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 text-left select-none whitespace-nowrap [:root[data-density=compact]_&]:px-4 [:root[data-density=compact]_&]:py-2",
    ROW: "border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors duration-150 group",
    CELL: "px-6 py-4 text-[15px] whitespace-nowrap [:root[data-density=compact]_&]:px-4 [:root[data-density=compact]_&]:py-2 [:root[data-density=compact]_&]:text-sm",
  }
};

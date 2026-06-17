/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // 동적 색상 클래스 (NewTaskView 카드, Sidebar 작업 아이콘 등)
    'bg-blue-50','bg-blue-100','text-blue-400','text-blue-700','text-blue-600','border-blue-400','border-blue-500','hover:border-blue-500',
    'bg-brand-50','bg-brand-100','text-brand-400','text-brand-600','border-brand-400',
    'bg-violet-50','bg-violet-100','text-violet-700','text-violet-600',
    'bg-amber-50','bg-amber-100','text-amber-700','text-amber-600','text-amber-500','border-amber-300',
    'bg-green-50','text-green-700','text-green-600','text-green-500',
    'bg-zinc-50','bg-zinc-100','text-zinc-400','text-zinc-500','text-zinc-600','text-zinc-700','text-zinc-800',
    'bg-gray-50','bg-gray-100','text-gray-400','text-gray-500','text-gray-600','text-gray-700','text-gray-800',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Consolas', 'Menlo', 'monospace'],
      },
      fontSize: {
        // 구 px → 표준 Tailwind 비례로 상향 조정 (class명 유지)
        'xs2':   ['12px', { lineHeight: '1.5' }],   // 구 10px → text-xs 근접
        'sm2':   ['13px', { lineHeight: '1.5' }],   // 구 11px → text-xs
        'md2':   ['13px', { lineHeight: '1.55' }],  // 구 12px → text-sm 근접
        'base2': ['14px', { lineHeight: '1.6' }],   // 구 13px → text-sm
        'lg2':   ['16px', { lineHeight: '1.5' }],   // 구 15px → text-base
        'xl2':   ['18px', { lineHeight: '1.4' }],   // 구 17px → text-lg
        'h1':    ['30px', { lineHeight: '1.25' }],  // 구 32px → text-3xl
      },
      colors: {
        // ── DESIGN_GUIDE Section 5: brand (axplain.ai 브랜드 블루 #3B8EF5 기반) ──
        brand: {
          50:  '#EBF3FE',
          100: '#D2E4FD',
          200: '#A5C9FB',
          300: '#6BA8F8',
          400: '#3B8EF5', // 브랜드 메인 — Primary CTA
          500: '#1E6FE0',
          600: '#004AAD',
          700: '#003A8C',
          800: '#002D6B',
          900: '#001F4A',
        },
        // ── DESIGN_GUIDE Section 5: neutral ──
        neutral: {
          0:   '#FFFFFF',
          50:  '#F8F9FB',
          100: '#F1F3F5',
          150: '#E9ECEF',
          200: '#DEE2E6',
          300: '#ADB5BD',
          400: '#868E96',
          500: '#495057',
          600: '#343A40',
          700: '#212529',
          800: '#0A0E1A',
        },
        // zinc (기존 중립 팔레트 유지 — 코드 전체 참조)
        zinc: {
          50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8',
          400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46',
          800: '#27272a', 900: '#18181b',
        },
        // gray → zinc 재매핑 (기존 text-gray-* 클래스 호환)
        gray: {
          50: '#fafafa', 100: '#f4f4f5', 200: '#e4e4e7', 300: '#d4d4d8',
          400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46',
          800: '#27272a', 900: '#18181b',
        },
        // blue — brand-400 기반으로 업데이트 (400 = 브랜드 메인)
        blue: {
          50: '#EBF3FE', 100: '#D2E4FD', 200: '#A5C9FB', 300: '#6BA8F8',
          400: '#3B8EF5', 500: '#1E6FE0', 600: '#004AAD', 700: '#003A8C',
          800: '#002D6B',
        },
        amber: { 50:'#fffbeb',100:'#fef3c7',300:'#fcd34d',500:'#f59e0b',600:'#d97706',700:'#b45309' },
        green: { 50:'#ecfdf5',500:'#22C55E',700:'#047857',800:'#065f46' },
        violet:{ 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',600:'#7c3aed',700:'#6d28d9' },
        // ck 토큰 (기존 코드 호환)
        ck: { bg: '#F8F9FB', border: '#E9ECEF' },
      },
      width:    { nav:'260px', 'nav-c':'72px', artifact:'360px' },
      minWidth: { nav:'260px', 'nav-c':'72px' },
      height:   { topbar:'48px', body:'calc(100vh - 48px)' },
      boxShadow:{
        'card':       '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(59,142,245,0.12)', // brand-400 틴트
        'card-deep':  '0 8px 24px rgba(0,0,0,0.08)',
        'md':         '0 4px 12px rgba(0,0,0,0.08)',
        'lg':         '0 8px 24px rgba(0,0,0,0.10)',
      },
      zIndex: { '60': '60' },
      animation: { 'fade-up': 'fadeUp 0.2s ease-out' },
      keyframes: {
        fadeUp: { '0%':{ opacity:'0', transform:'translateY(8px)' }, '100%':{ opacity:'1', transform:'translateY(0)' } },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')({ strategy: 'class' })],
}

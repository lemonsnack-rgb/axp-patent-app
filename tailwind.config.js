/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // 동적 색상 클래스 (NewTaskView 카드, Sidebar 작업 아이콘 등)
    'bg-blue-50','bg-blue-100','text-blue-700','text-blue-600','border-blue-500','hover:border-blue-500',
    'bg-violet-50','bg-violet-100','text-violet-700','text-violet-600',
    'bg-amber-50','bg-amber-100','text-amber-700','text-amber-600','text-amber-500','border-amber-300',
    'bg-green-50','text-green-700','text-green-600','text-green-500',
    'bg-gray-50','bg-gray-100','text-gray-400','text-gray-500','text-gray-600','text-gray-700','text-gray-800',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Consolas', 'Menlo', 'monospace'],
      },
      fontSize: {
        'xs2':  ['10px', '1.45'],
        'sm2':  ['11px', '1.5'],
        'md2':  ['12px', '1.55'],
        'base2':['13px', '1.6'],
        'lg2':  ['15px', '1.5'],
        'xl2':  ['17px', '1.4'],
        'h1':   ['32px', '1.25'],
      },
      colors: {
        blue: {
          50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',
          500:'#3b82f6',600:'#2563eb',700:'#1e5fa6',800:'#1e40af',
        },
        gray: {
          50:'#fafbfc',100:'#f3f4f6',200:'#e5e7eb',300:'#d1d5db',
          400:'#9ca3af',500:'#6b7280',600:'#4b5563',700:'#374151',800:'#1f2937',
        },
        amber: { 50:'#fffbeb',300:'#fcd34d',500:'#f59e0b',600:'#d97706',700:'#b45309' },
        green: { 50:'#ecfdf5',500:'#10b981',700:'#047857',800:'#065f46' },
        violet:{ 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',600:'#7c3aed',700:'#6d28d9' },
        ck: { bg:'#fafbfc', border:'#e5e7eb' },
      },
      width:    { nav:'260px', 'nav-c':'72px', artifact:'360px' },
      minWidth: { nav:'260px', 'nav-c':'72px' },
      height:   { topbar:'48px', body:'calc(100vh - 48px)' },
      boxShadow:{
        'card-hover':'0 4px 12px rgba(0,0,0,0.05)',
        'card-deep' :'0 6px 16px rgba(0,0,0,0.06)',
      },
      animation: { 'fade-up':'fadeUp 0.22s ease-out' },
      keyframes: {
        fadeUp: { '0%':{opacity:'0',transform:'translateY(6px)'}, '100%':{opacity:'1',transform:'translateY(0)'} },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')({ strategy: 'class' })],
}

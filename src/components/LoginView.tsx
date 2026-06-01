import { useState } from 'react';

interface Props {
  onLogin: () => void;
}

export function LoginView({ onLogin }: Props) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      if (id === 'muhayu' && pw === 'scl2026!') {
        sessionStorage.setItem('axp_auth', '1');
        onLogin();
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-ck-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#1d4ed8)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">AXPlain.ai</h1>
          <p className="text-sm2 text-gray-500 mt-1">특허 명세서 작성 플랫폼</p>
        </div>

        {/* 로그인 폼 */}
        <div className="card p-6 shadow-card-deep">
          <h2 className="text-base2 font-bold text-gray-800 mb-5">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm2 font-semibold text-gray-700 mb-1.5">아이디</label>
              <input
                type="text"
                className="input py-2.5 w-full"
                placeholder="아이디를 입력하세요"
                value={id}
                onChange={e => setId(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm2 font-semibold text-gray-700 mb-1.5">비밀번호</label>
              <input
                type="password"
                className="input py-2.5 w-full"
                placeholder="비밀번호를 입력하세요"
                value={pw}
                onChange={e => setPw(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs2 text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !id.trim() || !pw.trim()}
              className="btn-primary w-full py-2.5 text-md2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs2 text-gray-400 mt-5">
          © 2026 AXPlain.ai · muhayu
        </p>
      </div>
    </div>
  );
}

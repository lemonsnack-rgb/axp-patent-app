import { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

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
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">

        {/* 로고 — brand-400 배경 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 bg-brand-400">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-neutral-700">AXPlain.ai</h1>
          <p className="text-sm2 text-neutral-400 mt-1">특허 명세서 작성 플랫폼</p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-xl border border-neutral-150 shadow-card p-6">
          <h2 className="text-base2 font-bold text-neutral-700 mb-5">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-id" className="block text-sm2 font-semibold text-neutral-600 mb-1.5">
                아이디
              </label>
              <Input
                id="login-id"
                type="text"
                placeholder="아이디를 입력하세요"
                value={id}
                onChange={e => setId(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="login-pw" className="block text-sm2 font-semibold text-neutral-600 mb-1.5">
                비밀번호
              </label>
              <Input
                id="login-pw"
                showPasswordToggle
                placeholder="비밀번호를 입력하세요"
                value={pw}
                onChange={e => setPw(e.target.value)}
                autoComplete="current-password"
              />
              {/* 비밀번호 찾기 */}
              <div className="text-right mt-1.5">
                <button type="button" className="text-xs2 text-brand-400 hover:text-brand-500 transition-colors">
                  비밀번호를 잊으셨나요?
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs2 text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              disabled={!id.trim() || !pw.trim()}
              className="w-full mt-2"
            >
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>

          {/* 가입 안내 */}
          <p className="text-center text-xs2 text-neutral-400 mt-4">
            계정이 없으신가요?{' '}
            <button type="button" className="text-brand-400 hover:text-brand-500 font-medium transition-colors">
              가입 문의
            </button>
          </p>
        </div>

        <p className="text-center text-xs2 text-neutral-300 mt-5">
          © 2026 AXPlain.ai · muhayu
        </p>
      </div>
    </div>
  );
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // /admin 以下へのアクセスに対して認証を要求
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const basicAuth = req.headers.get('authorization');
    const url = req.nextUrl;

    if (basicAuth) {
      const authValue = basicAuth.split(' ')[1];
      // atob関数を使用してBase64でエンコードされた認証情報をデコード
      const [user, pwd] = atob(authValue).split(':');

      // 環境変数からIDとパスワードを取得
      // ※ローカルでは .env.local に記載、クラウド環境ではFirebaseコンソールの環境変数に登録が必要です
      const validUser = process.env.BASIC_AUTH_USER;
      const validPassword = process.env.BASIC_AUTH_PASSWORD;

      // ユーザー名とパスワードが一致した場合はアクセスを許可
      if (user === validUser && pwd === validPassword) {
        return NextResponse.next();
      }
    }

    // 認証情報がない、または間違っている場合は401エラー（Basic認証ダイアログ）を返す
    url.pathname = '/api/auth';
    return new NextResponse('管理画面へのアクセス権限がありません。', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Admin Area"',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // /admin 以外の通常ページへのアクセスはそのまま許可
  return NextResponse.next();
}

// Middlewareを適用する範囲を限定
export const config = {
  matcher: ['/admin/:path*'],
};
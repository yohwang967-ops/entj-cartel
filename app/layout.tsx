import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"ENTJ 카르텔 · 대구", description:"대구 ENTJ의 일과 도전, 취미를 만나는 공개 프로필 디렉터리.", icons:{icon:"/favicon.svg"}, appleWebApp:{capable:true,title:"ENTJ 카르텔"} };
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="ko"><body>{children}</body></html>;
}

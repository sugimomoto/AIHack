import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { InviteCreate } from "@/components/invitation/InviteCreate";

export default function Page() {
  // S15 では画面の確認まで。認証と実際の発行は S16 で接続する
  return (
    <PhoneFrame>
      <InviteCreate senderName="架空 太郎" url="https://aida.example/invite/xxxxxxxxxxxx" />
    </PhoneFrame>
  );
}

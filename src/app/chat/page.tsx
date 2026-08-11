import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { LiveChat } from "@/components/chat/LiveChat";

/** S4 の確認用。認証とケースの接続は S16 */
export default function Page() {
  return (
    <PhoneFrame>
      <LiveChat consultationId="cons_verify" />
    </PhoneFrame>
  );
}

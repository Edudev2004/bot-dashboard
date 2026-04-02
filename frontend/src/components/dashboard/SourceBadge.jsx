import React from "react";
import { MessageCircle, Send } from "lucide-react";

const SourceBadge = ({ source }) => {
  const isWA = source === "whatsapp";
  return (
    <div className={`source-badge ${isWA ? "wa" : "tg"}`}>
      {isWA ? <MessageCircle size={13} /> : <Send size={13} />}
      <span>{isWA ? "WhatsApp" : "Telegram"}</span>
    </div>
  );
};

export default SourceBadge;

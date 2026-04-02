import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      className={`copy-btn ${copied ? "copied" : ""}`}
      onClick={handleCopy}
      title="Copiar ID"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
};

export default CopyButton;

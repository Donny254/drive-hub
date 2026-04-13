import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolveImageUrl, uploadImage } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

type CryptoProofUploaderProps = {
  token?: string | null;
  proofImageUrl: string | null;
  onProofImageUrlChange: (value: string | null) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
};

const CryptoProofUploader = ({
  token,
  proofImageUrl,
  onProofImageUrlChange,
  label = "Payment Proof",
  description = "Upload a clear screenshot or receipt of the transfer.",
  disabled = false,
  className,
}: CryptoProofUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    try {
      setUploading(true);
      const result = await uploadImage(file, token);
      onProofImageUrlChange(result.url);
      toast.success("Payment proof uploaded.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed";
      toast.error(message);
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className={className}>
      <div className="grid gap-2">
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled || uploading}
            onChange={(e) => void handleUpload(e.target.files?.[0])}
          />
          {proofImageUrl ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onProofImageUrlChange(null)}
              disabled={disabled || uploading}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {uploading
            ? "Uploading proof..."
            : proofImageUrl
              ? "Proof uploaded. You can remove or replace it before submitting."
              : "No proof uploaded yet."}
        </p>
      </div>

      {proofImageUrl ? (
        <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium">Uploaded proof</p>
              <p className="break-all text-xs text-muted-foreground">{proofImageUrl}</p>
            </div>
            <img
              src={resolveImageUrl(proofImageUrl)}
              alt="Payment proof"
              className="h-24 w-24 rounded-md border border-border object-cover"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CryptoProofUploader;

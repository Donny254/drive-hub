import { Check, X } from "lucide-react";
import { getPasswordChecks, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { cn } from "@/lib/utils";

type PasswordRequirementsProps = {
  password: string;
};

const items = (password: string) => {
  const checks = getPasswordChecks(password);
  return [
    { key: "minLength", label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: checks.minLength },
    { key: "uppercase", label: "One uppercase letter", met: checks.uppercase },
    { key: "lowercase", label: "One lowercase letter", met: checks.lowercase },
    { key: "number", label: "One number", met: checks.number },
  ];
};

const PasswordRequirements = ({ password }: PasswordRequirementsProps) => {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background/60 p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Password Checklist</p>
      <ul className="space-y-1.5">
        {items(password).map((item) => (
          <li
            key={item.key}
            className={cn(
              "flex items-center gap-2 text-sm",
              item.met ? "text-emerald-500" : "text-muted-foreground",
            )}
          >
            {item.met ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PasswordRequirements;

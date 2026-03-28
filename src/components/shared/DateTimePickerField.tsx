import { Input } from "@/components/ui/input";
import DatePickerField from "@/components/shared/DatePickerField";
import { getTodayDateValue } from "@/lib/date";

type DateTimePickerFieldProps = {
  value?: string | null;
  onChange: (value: string) => void;
  minDate?: string | null;
  disabled?: boolean;
};

const splitDateTimeValue = (value?: string | null) => {
  if (!value) return { date: "", time: "09:00" };
  const [date = "", time = "09:00"] = value.split("T");
  return {
    date,
    time: time.slice(0, 5) || "09:00",
  };
};

const DateTimePickerField = ({
  value,
  onChange,
  minDate,
  disabled = false,
}: DateTimePickerFieldProps) => {
  const { date, time } = splitDateTimeValue(value);
  const effectiveMinDate = minDate || getTodayDateValue();

  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
      <DatePickerField
        value={date}
        onChange={(nextDate) => onChange(`${nextDate}T${time || "09:00"}`)}
        minDate={effectiveMinDate}
        placeholder="Select date"
        disabled={disabled}
      />
      <Input
        type="time"
        value={time}
        onChange={(e) => onChange(`${date || effectiveMinDate}T${e.target.value || "09:00"}`)}
        disabled={disabled}
      />
    </div>
  );
};

export default DateTimePickerField;

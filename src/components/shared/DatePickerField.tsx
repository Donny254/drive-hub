import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateButtonLabel, parseDateInputValue } from "@/lib/date";

type DatePickerFieldProps = {
  value?: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string | null;
  disabled?: boolean;
};

const DatePickerField = ({
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  disabled = false,
}: DatePickerFieldProps) => {
  const minDateParsed = parseDateInputValue(minDate);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" className="justify-between" type="button" disabled={disabled}>
          {formatDateButtonLabel(value, placeholder)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={parseDateInputValue(value)}
          disabled={(date) => Boolean(minDateParsed && date < minDateParsed)}
          onSelect={(date) => {
            if (!date) return;
            onChange(
              `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
            );
          }}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  );
};

export default DatePickerField;

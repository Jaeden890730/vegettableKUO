import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "選擇...",
  emptyText = "找不到選項",
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options;
    const lower = inputValue.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(lower));
  }, [options, inputValue]);

  const showAddNew = inputValue && !options.some(
    (opt) => opt.toLowerCase() === inputValue.toLowerCase()
  );

  const handleSelect = (selected: string) => {
    onValueChange(selected);
    setOpen(false);
    setInputValue("");
  };

  const handleAddNew = () => {
    onValueChange(inputValue);
    setOpen(false);
    setInputValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          {value || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover z-50" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜尋或輸入新品項..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList className="max-h-[200px] overflow-y-auto" onWheel={(e) => e.stopPropagation()}>
            <CommandEmpty>
              {showAddNew ? null : emptyText}
            </CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
              {showAddNew && (
                <CommandItem onSelect={handleAddNew} className="text-primary">
                  <Plus className="mr-2 h-4 w-4" />
                  新增「{inputValue}」
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

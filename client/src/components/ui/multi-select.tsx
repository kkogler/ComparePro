import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxSelected?: number;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  className,
  disabled = false,
  maxSelected,
  searchPlaceholder = "Search...",
  emptyText = "No options found",
  clearable = true,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedOptions = options.filter((option) =>
    selected.includes(option.value)
  );

  const handleSelect = (optionValue: string) => {
    if (selected.includes(optionValue)) {
      // Remove from selection
      onChange(selected.filter((value) => value !== optionValue));
    } else {
      // Add to selection (if not at max limit)
      if (!maxSelected || selected.length < maxSelected) {
        onChange([...selected, optionValue]);
      }
    }
  };

  const handleRemove = (optionValue: string, event?: React.MouseEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    onChange(selected.filter((value) => value !== optionValue));
  };

  const handleClear = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onChange([]);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Backspace" && selected.length > 0) {
      // Remove last selected item on backspace
      const newSelected = [...selected];
      newSelected.pop();
      onChange(newSelected);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "min-h-10 h-auto w-full justify-between text-left font-normal",
            !selected.length && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedOptions.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <Badge
                  key={option.value}
                  variant="secondary"
                  className="mr-1 mb-1 px-2 py-1 text-xs"
                >
                  {option.label}
                  {clearable && (
                    <button
                      className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleRemove(option.value);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => handleRemove(option.value, e)}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </Badge>
              ))
            )}
          </div>
          <div className="flex items-center gap-2">
            {clearable && selected.length > 0 && (
              <button
                onClick={handleClear}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                const isDisabled = 
                  option.disabled || 
                  (maxSelected && !isSelected && selected.length >= maxSelected);
                
                return (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => !isDisabled && handleSelect(option.value)}
                    disabled={!!isDisabled}
                    className={cn(
                      "cursor-pointer",
                      isDisabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
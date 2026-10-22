'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Medicine } from '@/types';

interface MedicineSearchSelectProps {
  medicines: Medicine[];
  value: string;
  onValueChange: (medicineId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MedicineSearchSelect({
  medicines,
  value,
  onValueChange,
  placeholder = 'Search medicine...',
  disabled = false,
  className,
}: MedicineSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = medicines.find((medicine) => medicine.id === value);

  const filteredMedicines = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (terms.length === 0) {
      return medicines;
    }

    return medicines.filter((medicine) => {
      const searchable = [
        medicine.name,
        medicine.product_code,
        medicine.generic_name,
        medicine.strength,
        medicine.dosage_form,
        medicine.manufacturer?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return terms.every((term) => searchable.includes(term));
    });
  }, [medicines, query]);

  const selectMedicine = (medicineId: string) => {
    onValueChange(medicineId);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery('');
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-between px-3 font-normal',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">
            {selected
              ? `${selected.name} (${selected.product_code})`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && filteredMedicines.length > 0) {
                  event.preventDefault();
                  selectMedicine(filteredMedicines[0].id);
                }
              }}
              placeholder="Search name, code, generic, company..."
              className="h-8 pl-8"
              aria-label="Search medicines"
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto p-1">
          {filteredMedicines.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              {medicines.length === 0
                ? 'No medicines available. Add a medicine first.'
                : 'No medicines match your search.'}
            </div>
          ) : (
            filteredMedicines.map((medicine) => {
              const isSelected = medicine.id === value;

              return (
                <button
                  key={medicine.id}
                  type="button"
                  onClick={() => selectMedicine(medicine.id)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-accent focus:bg-accent',
                    isSelected && 'bg-accent'
                  )}
                >
                  <Check
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 text-primary',
                      !isSelected && 'opacity-0'
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {medicine.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {medicine.product_code}
                      {medicine.strength ? ` · ${medicine.strength}` : ''}
                      {medicine.manufacturer?.name
                        ? ` · ${medicine.manufacturer.name}`
                        : ''}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

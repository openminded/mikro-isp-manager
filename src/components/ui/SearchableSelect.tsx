import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface Option {
    label: string;
    value: string | number;
}

interface SearchableSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: any) => void;
    placeholder?: string;
    label?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
    error?: string;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select an option...",
    label,
    className,
    required = false,
    disabled = false,
    error
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Close on click outside
    const ref = useClickOutside<HTMLDivElement>(() => setIsOpen(false));

    // Find selected option label
    const selectedOption = options.find(opt => String(opt.value) === String(value));

    // Filter options
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        return options.filter(opt =>
            opt.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [options, searchTerm]);

    // Handle Selection
    const handleSelect = (val: string | number) => {
        onChange(val);
        setIsOpen(false);
        setSearchTerm(''); // Reset search on select
    };

    // Reset search when opening
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    return (
        <div className={twMerge("relative w-full", className)} ref={ref}>
            {label && (
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={clsx(
                    "w-full flex items-center justify-between px-3 py-2 border rounded-lg cursor-pointer transition-all bg-white",
                    "min-h-[42px]",
                    disabled ? "bg-slate-100 cursor-not-allowed opacity-70" : "hover:border-primary/50",
                    isOpen ? "ring-2 ring-primary/20 border-primary" : "border-slate-200",
                    error ? "border-red-300 ring-red-100" : ""
                )}
            >
                <div className={clsx("truncate", !selectedOption && "text-slate-400")}>
                    {selectedOption ? selectedOption.label : placeholder}
                </div>
                <ChevronDown className={clsx("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
            </div>

            {/* Error Message */}
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}

            {/* Dropdown Menu */}
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Input */}
                    <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                autoFocus
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                            {searchTerm && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2"
                                >
                                    <X className="w-3 h-3 text-slate-400 hover:text-slate-600" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-[250px] overflow-y-auto">
                        {filteredOptions.length > 0 ? (
                            <ul className="py-1">
                                {filteredOptions.map((option, idx) => {
                                    const isSelected = String(option.value) === String(value);
                                    return (
                                        <li
                                            key={`${option.value}-${idx}`}
                                            onClick={() => handleSelect(option.value)}
                                            className={clsx(
                                                "px-3 py-2 text-sm cursor-pointer flex items-center justify-between group",
                                                isSelected ? "bg-primary/5 text-primary font-medium" : "text-slate-700 hover:bg-slate-50"
                                            )}
                                        >
                                            <span>{option.label}</span>
                                            {isSelected && <Check className="w-4 h-4" />}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="p-4 text-center text-sm text-slate-400">
                                No results found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Utility to helper function for converting plain array to options
export const toOptions = (array: string[]) => array.map(v => ({ label: v, value: v }));

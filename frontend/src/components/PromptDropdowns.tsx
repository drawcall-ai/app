import { useState } from "react";
import * as Select from "@radix-ui/react-select";
import { ChevronDownIcon, ChevronUpIcon, Sparkles } from "lucide-react";

interface DropdownOption {
  value: string;
  label: string;
  image: string;
}

interface DropdownOptionDisplayProps {
  option: DropdownOption;
  isSelected?: boolean;
  className?: string;
}

function DropdownOptionDisplay({
  option,
  isSelected = false,
  className = "",
}: DropdownOptionDisplayProps) {
  return (
    <div
      className={`relative w-full h-full overflow-hidden rounded-lg ${className}`}
    >
      <img
        src={option.image}
        alt={option.label}
        className="w-full h-full object-cover"
      />
      <span className="text-black/50 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-bold text-xs drop-shadow-lg">
        {option.label === "Automatic" ? (
          <Sparkles className="w-4 h-4" />
        ) : (
          option.label
        )}
      </span>
      {isSelected && (
        <div className="absolute inset-0 border-4 border-white rounded-lg" />
      )}
    </div>
  );
}

interface DropdownProps {
  category: string;
  options: DropdownOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

function Dropdown({
  category,
  options,
  selectedValue,
  onSelect,
  disabled,
}: DropdownProps) {
  const selectedOption =
    options.find((opt) => opt.value === selectedValue) || options[0];

  if (!selectedOption) {
    return null;
  }

  return (
    <div className="relative grow basis-0 flex flex-col gap-1">
      <Select.Root
        value={selectedValue}
        onValueChange={onSelect}
        disabled={disabled}
      >
        <Select.Trigger className="w-full h-12 cursor-pointer outline-none">
          <div className="relative w-full h-full">
            <DropdownOptionDisplay option={selectedOption} />
            <div className="absolute top-2 right-2">
              <Select.Icon>
                <ChevronDownIcon className="w-4 h-4 text-white drop-shadow-lg" />
              </Select.Icon>
            </div>
          </div>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className="overflow-hidden bg-gray-600/50 backdrop-blur-sm rounded-lg z-50 min-w-[140px]"
            position="popper"
            sideOffset={8}
            align="center"
          >
            <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-gray-700/50 text-white cursor-default">
              <ChevronUpIcon className="w-4 h-4" />
            </Select.ScrollUpButton>

            <Select.Viewport className="p-2">
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="relative cursor-pointer mb-2 last:mb-0 outline-none focus:ring-2 focus:ring-white/50 data-[highlighted]:ring-2 data-[highlighted]:ring-white/50 rounded-lg"
                >
                  <div className="h-16">
                    <DropdownOptionDisplay
                      option={option}
                      isSelected={option.value === selectedValue}
                    />
                  </div>
                </Select.Item>
              ))}
            </Select.Viewport>

            <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-gray-700/50 text-white cursor-default">
              <ChevronDownIcon className="w-4 h-4" />
            </Select.ScrollDownButton>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <div className="flex justify-center">
        <span className="text-white/60 font-medium text-xs uppercase tracking-wider">
          {category}
        </span>
      </div>
    </div>
  );
}

export type PromptState = {
  space: string;
  vibe: string;
  material: string;
  arrangement: string;
};

interface PromptDropdownsProps {
  onSelectionChange: (state: PromptState) => void;
  state: PromptState;
  disabled?: boolean;
}

export function PromptDropdowns({
  onSelectionChange,
  state,
  disabled,
}: PromptDropdownsProps) {
  const categories = {
    space: [
      {
        value: "automatic",
        label: "Automatic",
        image: "/prompt-builder/space/ai.webp",
      },
      {
        value: "comfortable",
        label: "Comfortable",
        image: "/prompt-builder/space/comfortable.webp",
      },
      {
        value: "spacious",
        label: "Spacious",
        image: "/prompt-builder/space/spacious.webp",
      },
      {
        value: "tight",
        label: "Tight",
        image: "/prompt-builder/space/tight.webp",
      },
    ],
    vibe: [
      {
        value: "automatic",
        label: "Automatic",
        image: "/prompt-builder/vibe/ai.webp",
      },
      {
        value: "artistic",
        label: "Artistic",
        image: "/prompt-builder/vibe/artistic.webp",
      },
      {
        value: "elegant",
        label: "Elegant",
        image: "/prompt-builder/vibe/elegant.webp",
      },
      {
        value: "functional",
        label: "Functional",
        image: "/prompt-builder/vibe/functional.webp",
      },
      {
        value: "natural",
        label: "Natural",
        image: "/prompt-builder/vibe/natural.webp",
      },
      {
        value: "playful",
        label: "Playful",
        image: "/prompt-builder/vibe/playful.webp",
      },
      {
        value: "professional",
        label: "Professional",
        image: "/prompt-builder/vibe/professional.webp",
      },
    ],
    material: [
      {
        value: "flat",
        label: "Flat",
        image: "/prompt-builder/material/flat.webp",
      },
      {
        value: "glass",
        label: "Glass",
        image: "/prompt-builder/material/glass.webp",
      },
      {
        value: "metal",
        label: "Metal",
        image: "/prompt-builder/material/metal.webp",
      },
      {
        value: "mixed",
        label: "Mixed",
        image: "/prompt-builder/material/mixed.webp",
      },
      {
        value: "plastic",
        label: "Plastic",
        image: "/prompt-builder/material/plastic.webp",
      },
    ],
    arrangement: [
      {
        value: "billboard",
        label: "Billboard",
        image: "/prompt-builder/arrangement/billboard.webp",
      },
      {
        value: "disjoint",
        label: "Disjoint",
        image: "/prompt-builder/arrangement/disjoint.webp",
      },
    ],
  };

  const handleSelectionChange = (
    category: keyof typeof state,
    value: string
  ) => {
    const newSelections = { ...state, [category]: value };
    onSelectionChange(newSelections);
  };

  return (
    <div className="flex px-4 gap-3 w-full flex-wrap justify-center">
      <Dropdown
        category="Spacing"
        options={categories.space}
        selectedValue={state.space}
        onSelect={(value) => handleSelectionChange("space", value)}
        disabled={disabled}
      />
      <Dropdown
        category="Vibe"
        options={categories.vibe}
        selectedValue={state.vibe}
        onSelect={(value) => handleSelectionChange("vibe", value)}
        disabled={disabled}
      />
      <Dropdown
        category="Material"
        options={categories.material}
        selectedValue={state.material}
        onSelect={(value) => handleSelectionChange("material", value)}
        disabled={disabled}
      />
      <Dropdown
        category="Arrangement"
        options={categories.arrangement}
        selectedValue={state.arrangement}
        onSelect={(value) => handleSelectionChange("arrangement", value)}
        disabled={disabled}
      />
    </div>
  );
}

import { useState } from "react";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

const sportsOptions: MultiSelectOption[] = [
  { value: "cycling", label: "Cycling" },
  { value: "boxing", label: "Boxing" },
  { value: "swimming", label: "Swimming" },
  { value: "running", label: "Running" },
  { value: "tennis", label: "Tennis" },
  { value: "basketball", label: "Basketball" },
  { value: "football", label: "Football" },
  { value: "baseball", label: "Baseball" },
  { value: "golf", label: "Golf" },
  { value: "volleyball", label: "Volleyball" },
];

const countryOptions: MultiSelectOption[] = [
  { value: "us", label: "United States" },
  { value: "ca", label: "Canada" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "jp", label: "Japan" },
  { value: "au", label: "Australia" },
  { value: "br", label: "Brazil" },
];

export default function MultiSelectDemo() {
  const [selectedSports, setSelectedSports] = useState<string[]>(["cycling", "boxing"]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedLimited, setSelectedLimited] = useState<string[]>([]);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Multi-Select Component Demo</h1>
        <p className="text-gray-600">
          A Kendo UI-style multi-select component with tags, search, and customizable options.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Multi-Select */}
        <Card>
          <CardHeader>
            <CardTitle>Favorite Sports</CardTitle>
            <CardDescription>
              Select your favorite sports. This example starts with "Cycling" and "Boxing" pre-selected.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Choose your hobbies:</Label>
              <MultiSelect
                options={sportsOptions}
                selected={selectedSports}
                onChange={setSelectedSports}
                placeholder="Add your favourite sport, if it is not in the list."
                searchPlaceholder="Search sports..."
                data-testid="sports-multiselect"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Sports:</Label>
              <div className="flex flex-wrap gap-2">
                {selectedSports.length === 0 ? (
                  <span className="text-sm text-muted-foreground">None selected</span>
                ) : (
                  selectedSports.map((sport) => {
                    const option = sportsOptions.find(opt => opt.value === sport);
                    return (
                      <Badge key={sport} variant="outline">
                        {option?.label}
                      </Badge>
                    );
                  })
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Countries Multi-Select */}
        <Card>
          <CardHeader>
            <CardTitle>Countries Visited</CardTitle>
            <CardDescription>
              Track which countries you've visited with a searchable multi-select.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Countries you've been to:</Label>
              <MultiSelect
                options={countryOptions}
                selected={selectedCountries}
                onChange={setSelectedCountries}
                placeholder="Select countries..."
                searchPlaceholder="Search countries..."
                emptyText="No countries found"
                data-testid="countries-multiselect"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Travel Count:</Label>
              <p className="text-sm text-muted-foreground">
                You've visited {selectedCountries.length} countries
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Limited Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Top 3 Sports (Limited Selection)</CardTitle>
            <CardDescription>
              This multi-select is limited to a maximum of 3 selections.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Pick your top 3 sports:</Label>
              <MultiSelect
                options={sportsOptions}
                selected={selectedLimited}
                onChange={setSelectedLimited}
                placeholder="Select up to 3 sports..."
                maxSelected={3}
                searchPlaceholder="Search sports..."
                data-testid="limited-multiselect"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Selection Status: {selectedLimited.length}/3
              </Label>
              {selectedLimited.length === 3 && (
                <p className="text-sm text-amber-600">
                  Maximum selections reached. Remove an item to add another.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Non-clearable Example */}
        <Card>
          <CardHeader>
            <CardTitle>Required Sports (Non-clearable)</CardTitle>
            <CardDescription>
              This example has the clear functionality disabled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Essential sports (can't clear all):</Label>
              <MultiSelect
                options={sportsOptions}
                selected={selectedSports}
                onChange={setSelectedSports}
                placeholder="Select required sports..."
                clearable={false}
                searchPlaceholder="Search sports..."
                data-testid="non-clearable-multiselect"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature List */}
      <Card>
        <CardHeader>
          <CardTitle>Component Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium">Core Features:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Multi-selection with tag/badge display</li>
                <li>• Searchable dropdown with filtering</li>
                <li>• Individual item removal via X button</li>
                <li>• Clear all functionality</li>
                <li>• Keyboard navigation support</li>
                <li>• Backspace to remove last item</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Customization Options:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Maximum selection limits</li>
                <li>• Custom placeholder text</li>
                <li>• Disable clearing functionality</li>
                <li>• Individual option disabling</li>
                <li>• Custom search and empty state text</li>
                <li>• Full styling customization</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
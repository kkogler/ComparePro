/**
 * Centralized pricing strategy configuration
 * NO HARDCODED REFERENCES - All pricing strategies must be defined here
 */

export const PRICING_STRATEGIES = {
  MAP: {
    value: 'map',
    displayName: 'MAP (Minimum Advertised Price)',
    description: 'Use the MAP price from vendor data'
  },
  MSRP: {
    value: 'msrp',
    displayName: 'MSRP (Manufacturer Suggested Retail Price)',
    description: 'Use the MSRP price from vendor data'
  },
  PERCENTAGE_MARKUP: {
    value: 'percentage_markup',
    displayName: 'Percentage Markup',
    description: 'Apply a percentage markup to the cost'
  },
  TARGETED_MARGIN: {
    value: 'targeted_margin',
    displayName: 'Targeted Margin',
    description: 'Calculate price to achieve a target margin percentage'
  },
  PREMIUM_OVER_MAP: {
    value: 'premium_over_map',
    displayName: 'Premium Over MAP',
    description: 'Add a fixed premium amount to the MAP price'
  },
  DISCOUNT_TO_MSRP: {
    value: 'discount_to_msrp',
    displayName: 'Discount to MSRP',
    description: 'Apply a discount percentage to the MSRP price'
  },
  COST_MARKUP: {
    value: 'cost_markup',
    displayName: 'Cost Markup',
    description: 'Apply a percentage markup to the wholesale cost'
  },
  COST_MARGIN: {
    value: 'cost_margin',
    displayName: 'Cost Margin',
    description: 'Calculate price to achieve a target margin based on cost'
  },
  MAP_PREMIUM: {
    value: 'map_premium',
    displayName: 'MAP Premium',
    description: 'Add a premium amount to the MAP price'
  },
  MSRP_DISCOUNT: {
    value: 'msrp_discount',
    displayName: 'MSRP Discount',
    description: 'Apply a discount to the MSRP price'
  }
} as const;

export const PRICING_STRATEGY_INDICATORS = {
  FRONTEND_CALCULATED: {
    value: 'frontend_calculated',
    displayName: 'Frontend Calculated',
    description: 'Price calculated in frontend using cross-vendor fallback logic'
  },
  BACKEND_CALCULATED: {
    value: 'backend_calculated',
    displayName: 'Backend Calculated',
    description: 'Price calculated in backend using standard pricing rules'
  },
  COST_FALLBACK: {
    value: 'cost',
    displayName: 'Cost Fallback',
    description: 'Using wholesale cost as fallback when pricing rules fail'
  }
} as const;

export const CROSS_VENDOR_FALLBACK_SUFFIXES = {
  CROSS_VENDOR: '_cross_vendor',
  MSRP_FALLBACK: '_msrp_fallback',
  MAP_FALLBACK: '_map_fallback'
} as const;

export const ROUNDING_RULES = {
  NONE: {
    value: 'none',
    displayName: 'No Rounding',
    description: 'Round to 2 decimal places only'
  },
  UP_99: {
    value: 'up_99',
    displayName: 'Round Up to $X.99',
    description: 'Round up to nearest dollar, ending in .99'
  },
  DOWN_99: {
    value: 'down_99',
    displayName: 'Round Down to $X.99',
    description: 'Round down to previous dollar, ending in .99'
  },
  UP_95: {
    value: 'up_95',
    displayName: 'Round Up to $X.95',
    description: 'Round up to nearest dollar, ending in .95'
  },
  DOWN_95: {
    value: 'down_95',
    displayName: 'Round Down to $X.95',
    description: 'Round down to previous dollar, ending in .95'
  },
  UP_10CENT: {
    value: 'up_10cent',
    displayName: 'Round Up to 10 Cents',
    description: 'Round up to nearest 10 cent increment'
  },
  DOWN_10CENT: {
    value: 'down_10cent',
    displayName: 'Round Down to 10 Cents',
    description: 'Round down to nearest 10 cent increment'
  },
  NEAREST_DOLLAR: {
    value: 'nearest_dollar',
    displayName: 'Round to Nearest Dollar',
    description: 'Round to closest whole dollar amount'
  },
  UP_DOLLAR: {
    value: 'up_dollar',
    displayName: 'Round Up to Dollar',
    description: 'Round up to nearest whole dollar'
  }
} as const;

// Helper functions to get strategy values
export const getAllPricingStrategyValues = (): string[] => {
  return Object.values(PRICING_STRATEGIES).map(strategy => strategy.value);
};

export const getAllRoundingRuleValues = (): string[] => {
  return Object.values(ROUNDING_RULES).map(rule => rule.value);
};

export const getPricingStrategyDisplayName = (value: string): string => {
  const strategy = Object.values(PRICING_STRATEGIES).find(s => s.value === value);
  return strategy?.displayName || value;
};

export const getRoundingRuleDisplayName = (value: string): string => {
  const rule = Object.values(ROUNDING_RULES).find(r => r.value === value);
  return rule?.displayName || value;
};
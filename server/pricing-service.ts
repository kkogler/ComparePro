import { PricingConfiguration } from '@shared/schema';

export interface PricingInputs {
  cost?: number;
  msrp?: number;
  mapPrice?: number;
}

export interface PricingResult {
  finalPrice: number;
  strategy: string;
  appliedRounding: string;
  originalPrice?: number;
}

/**
 * Comprehensive pricing service with support for all pricing strategies and rounding rules
 */
export class PricingService {
  
  /**
   * Calculate retail price using the provided pricing configuration
   */
  static calculateRetailPrice(
    inputs: PricingInputs,
    config: PricingConfiguration,
    allVendorData?: { [vendorName: string]: PricingInputs }
  ): PricingResult {
    let calculatedPrice: number;
    let strategyUsed = config.strategy;
    
    // Apply primary pricing strategy
    calculatedPrice = this.applyPricingStrategy(inputs, config);
    
    // Cross-vendor fallback for MAP/MSRP strategies if enabled and primary strategy failed
    if (calculatedPrice === 0 && config.useCrossVendorFallback && allVendorData) {
      const crossVendorPrice = this.applyCrossVendorFallback(config.strategy, allVendorData);
      if (crossVendorPrice > 0) {
        calculatedPrice = crossVendorPrice;
        strategyUsed = `${config.strategy}_cross_vendor`;
      }
    }
    
    const originalPrice = calculatedPrice;
    
    // Apply rounding rules
    const finalPrice = this.applyRounding(calculatedPrice, config.roundingRule, config.roundingAmount);
    
    return {
      finalPrice,
      strategy: strategyUsed,
      appliedRounding: config.roundingRule,
      originalPrice,
    };
  }
  
  /**
   * Apply the primary pricing strategy
   */
  private static applyPricingStrategy(
    inputs: PricingInputs,
    config: PricingConfiguration
  ): number {
    switch (config.strategy) {
      case 'map':
        return inputs.mapPrice ? inputs.mapPrice : 0;
        
      case 'msrp':
        return inputs.msrp ? inputs.msrp : 0;
        
      case 'cost_markup':
        if (inputs.cost && config.markupPercentage) {
          const markup = parseFloat(config.markupPercentage.toString());
          return inputs.cost * (1 + markup / 100);
        }
        return 0;
        
      case 'cost_margin':
        if (inputs.cost && config.marginPercentage) {
          const margin = parseFloat(config.marginPercentage.toString());
          return inputs.cost / (1 - margin / 100);
        }
        return 0;
        
      case 'map_premium':
        if (inputs.mapPrice && config.premiumAmount) {
          const premium = parseFloat(config.premiumAmount.toString());
          return inputs.mapPrice + premium;
        }
        return 0;
        
      case 'msrp_discount':
        if (inputs.msrp && config.discountPercentage) {
          const discount = parseFloat(config.discountPercentage.toString());
          return inputs.msrp * (1 - discount / 100);
        }
        return 0;
        
      default:
        return 0;
    }
  }
  
  // COMPLETELY REMOVED: applyFallbackStrategy function 
  // User requires 100% authentic vendor data only - no fabricated values
  
  /**
   * Apply rounding rules to the calculated price
   */
  private static applyRounding(
    price: number,
    roundingRule: string,
    roundingAmount?: any
  ): number {
    if (price <= 0) return 0;
    
    switch (roundingRule) {
      case 'none':
        return Math.round(price * 100) / 100; // Round to 2 decimal places
        
      case 'up_99':
        return Math.floor(price) + 0.99;
        
      case 'down_99':
        return Math.floor(price - 1) + 0.99;
        
      case 'up_95':
        return Math.floor(price) + 0.95;
        
      case 'down_95':
        return Math.floor(price - 1) + 0.95;
        
      case 'up_10cent':
        // Round up to nearest 10 cents
        return Math.ceil(price * 10) / 10;
        
      case 'down_10cent':
        // Round down to nearest 10 cents
        return Math.floor(price * 10) / 10;
        
      case 'nearest_dollar':
        // Round to closest $1
        return Math.round(price);
        
      case 'up_dollar':
        // Round up to nearest $1
        return Math.ceil(price);
        
      default:
        return Math.round(price * 100) / 100; // Default to 2 decimal places
    }
  }

  /**
   * Apply cross-vendor fallback for MAP/MSRP strategies
   * Uses the highest MAP/MSRP value from other vendors in the price comparison
   */
  private static applyCrossVendorFallback(
    strategy: string,
    allVendorData: { [vendorName: string]: PricingInputs }
  ): number {
    const relevantValues: number[] = [];
    
    // Collect MAP or MSRP values from all vendors
    Object.values(allVendorData).forEach(vendorData => {
      if (strategy === 'map' || strategy === 'map_premium') {
        if (vendorData.mapPrice && vendorData.mapPrice > 0) {
          relevantValues.push(vendorData.mapPrice);
        }
      } else if (strategy === 'msrp' || strategy === 'msrp_discount') {
        if (vendorData.msrp && vendorData.msrp > 0) {
          relevantValues.push(vendorData.msrp);
        }
      }
    });
    
    // Return the highest value found, or 0 if none
    return relevantValues.length > 0 ? Math.max(...relevantValues) : 0;
  }
  
  /**
   * Get example prices for different rounding rules
   */
  static getRoundingExamples(price: number = 24.67): Record<string, string> {
    return {
      'none': this.applyRounding(price, 'none').toFixed(2),
      'up_99': this.applyRounding(price, 'up_99').toFixed(2),
      'down_99': this.applyRounding(price, 'down_99').toFixed(2),
      'up_95': this.applyRounding(price, 'up_95').toFixed(2),
      'down_95': this.applyRounding(price, 'down_95').toFixed(2),
      'up_10cent': this.applyRounding(price, 'up_10cent').toFixed(2),
      'down_10cent': this.applyRounding(price, 'down_10cent').toFixed(2),
      'nearest_dollar': this.applyRounding(price, 'nearest_dollar').toFixed(2),
      'up_dollar': this.applyRounding(price, 'up_dollar').toFixed(2),
    };
  }
  
  /**
   * Validate pricing configuration completeness
   */
  static validatePricingConfiguration(config: PricingConfiguration): string[] {
    const errors: string[] = [];
    
    // Validate primary strategy requirements
    switch (config.strategy) {
      case 'cost_markup':
        if (!config.markupPercentage) {
          errors.push('Markup percentage is required for cost markup strategy');
        }
        break;
        
      case 'cost_margin':
        if (!config.marginPercentage) {
          errors.push('Margin percentage is required for cost margin strategy');
        }
        break;
        
      case 'map_premium':
        if (!config.premiumAmount) {
          errors.push('Premium amount is required for MAP premium strategy');
        }
        break;
        
      case 'msrp_discount':
        if (!config.discountPercentage) {
          errors.push('Discount percentage is required for MSRP discount strategy');
        }
        break;
    }
    
    // REMOVED: All fallback validation - no fallbacks allowed
    
    return errors;
  }
}
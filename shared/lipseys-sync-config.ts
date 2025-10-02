// Lipsey's Catalog Sync Configuration
// Independent settings for Lipsey's catalog synchronization

export enum LipseysDuplicateHandling {
  IGNORE = 'ignore',           // Skip existing products completely
  SMART_MERGE = 'smart_merge', // Merge/enhance existing data (recommended)
  OVERWRITE = 'overwrite'      // Replace entire Master Catalog record
}

export interface LipseysSyncSettings {
  duplicateHandling: LipseysDuplicateHandling;
  imageHandling: {
    updateIfMissing: boolean;
    replaceWithHigherQuality: boolean;
  };
  descriptionHandling: {
    addIfMissing: boolean;
    overwriteExisting: boolean;
  };
  categoryHandling: {
    updateIfMoreSpecific: boolean;
    overwriteExisting: boolean;
  };
  specificationHandling: {
    mergeWithExisting: boolean;
    overwriteExisting: boolean;
  };
}

export const DEFAULT_LIPSEYS_SYNC_SETTINGS: LipseysSyncSettings = {
  duplicateHandling: LipseysDuplicateHandling.SMART_MERGE,
  imageHandling: {
    updateIfMissing: true,
    replaceWithHigherQuality: true
  },
  descriptionHandling: {
    addIfMissing: true,
    overwriteExisting: false  // Don't overwrite existing descriptions
  },
  categoryHandling: {
    updateIfMoreSpecific: true,
    overwriteExisting: false  // Don't overwrite existing categories
  },
  specificationHandling: {
    mergeWithExisting: true,   // Merge specifications with existing data
    overwriteExisting: false   // Don't overwrite existing specs
  }
};

// Helper function to get sync settings
export function getLipseysSyncSettings(): LipseysSyncSettings {
  return DEFAULT_LIPSEYS_SYNC_SETTINGS;
}

// Helper function to validate sync settings
export function validateLipseysSyncSettings(settings: any): settings is LipseysSyncSettings {
  return (
    settings &&
    typeof settings.duplicateHandling === 'string' &&
    Object.values(LipseysDuplicateHandling).includes(settings.duplicateHandling) &&
    typeof settings.imageHandling === 'object' &&
    typeof settings.descriptionHandling === 'object' &&
    typeof settings.categoryHandling === 'object' &&
    typeof settings.specificationHandling === 'object'
  );
}



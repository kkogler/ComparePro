// Sports South Catalog Sync Configuration
// Independent settings for Sports South catalog synchronization

export enum SportsSouthDuplicateHandling {
  IGNORE = 'ignore',           // Skip existing products completely
  SMART_MERGE = 'smart_merge', // Merge/enhance existing data (recommended)
  OVERWRITE = 'overwrite'      // Replace entire Master Catalog record
}

export interface SportsSouthSyncSettings {
  duplicateHandling: SportsSouthDuplicateHandling;
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
}

export const DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS: SportsSouthSyncSettings = {
  duplicateHandling: SportsSouthDuplicateHandling.SMART_MERGE,
  imageHandling: {
    updateIfMissing: true,
    replaceWithHigherQuality: true
  },
  descriptionHandling: {
    addIfMissing: true,
    overwriteExisting: false
  },
  categoryHandling: {
    updateIfMoreSpecific: true,
    overwriteExisting: false
  }
};

// Helper function to get sync settings
export function getSportsSouthSyncSettings(): SportsSouthSyncSettings {
  return DEFAULT_SPORTS_SOUTH_SYNC_SETTINGS;
}

// Helper function to validate sync settings
export function validateSportsSouthSyncSettings(settings: any): settings is SportsSouthSyncSettings {
  return (
    settings &&
    Object.values(SportsSouthDuplicateHandling).includes(settings.duplicateHandling) &&
    typeof settings.imageHandling === 'object' &&
    typeof settings.descriptionHandling === 'object' &&
    typeof settings.categoryHandling === 'object'
  );
}
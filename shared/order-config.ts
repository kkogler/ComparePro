/**
 * Centralized Order Configuration
 * 
 * This file contains all order-related constants and configuration
 * to eliminate hardcoded references throughout the codebase.
 * 
 * Architectural Rule: All order logic must use this configuration
 * instead of hardcoded status strings or type comparisons.
 */

export interface OrderStatusConfig {
  value: string;
  displayName: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export interface OrderTypeConfig {
  value: string;
  displayName: string;
  description: string;
  vendorSupport: string[];
}

/**
 * Order Status Configurations
 */
export const ORDER_STATUSES: Record<string, OrderStatusConfig> = {
  DRAFT: {
    value: 'draft',
    displayName: 'Draft',
    description: 'Order being created but not yet submitted',
    isActive: true,
    sortOrder: 1,
  },
  OPEN: {
    value: 'open',
    displayName: 'Open',
    description: 'Order submitted and awaiting fulfillment',
    isActive: true,
    sortOrder: 2,
  },
  COMPLETE: {
    value: 'complete',
    displayName: 'Complete',
    description: 'Order fully fulfilled and received',
    isActive: true,
    sortOrder: 3,
  },
  CANCELLED: {
    value: 'cancelled',
    displayName: 'Cancelled',
    description: 'Order cancelled before fulfillment',
    isActive: true,
    sortOrder: 4,
  },
};

/**
 * Order Item Status Configurations
 */
export const ORDER_ITEM_STATUSES: Record<string, OrderStatusConfig> = {
  PENDING: {
    value: 'pending',
    displayName: 'Pending',
    description: 'Item added to order but not yet processed',
    isActive: true,
    sortOrder: 1,
  },
  ORDERED: {
    value: 'ordered',
    displayName: 'Ordered',
    description: 'Item ordered from vendor',
    isActive: true,
    sortOrder: 2,
  },
  SHIPPED: {
    value: 'shipped',
    displayName: 'Shipped',
    description: 'Item shipped from vendor',
    isActive: true,
    sortOrder: 3,
  },
  RECEIVED: {
    value: 'received',
    displayName: 'Received',
    description: 'Item received and verified',
    isActive: true,
    sortOrder: 4,
  },
  BACKORDERED: {
    value: 'backordered',
    displayName: 'Backordered',
    description: 'Item temporarily out of stock',
    isActive: true,
    sortOrder: 5,
  },
};

/**
 * Order Type Configurations
 */
export const ORDER_TYPES: Record<string, OrderTypeConfig> = {
  STANDARD: {
    value: 'standard',
    displayName: 'Standard Order',
    description: 'Regular inventory order to store location',
    vendorSupport: ['lipsey', 'chattanooga', 'gunbroker'],
  },
  DROPSHIP_ACCESSORY: {
    value: 'dropship_accessory',
    displayName: 'Drop-ship Accessory',
    description: 'Direct shipment of accessories to customer',
    vendorSupport: ['lipsey'],
  },
  DROPSHIP_FIREARM: {
    value: 'dropship_firearm',
    displayName: 'Drop-ship Firearm',
    description: 'Direct shipment of firearms to FFL dealer',
    vendorSupport: ['lipsey'],
  },
};

/**
 * Default configurations
 */
export const DEFAULT_ORDER_STATUS = ORDER_STATUSES.DRAFT;
export const DEFAULT_ORDER_ITEM_STATUS = ORDER_ITEM_STATUSES.PENDING;
export const DEFAULT_ORDER_TYPE = ORDER_TYPES.STANDARD;

/**
 * Helper functions
 */
export function getOrderStatusByValue(value: string): OrderStatusConfig | undefined {
  return Object.values(ORDER_STATUSES).find(status => status.value === value);
}

export function getOrderItemStatusByValue(value: string): OrderStatusConfig | undefined {
  return Object.values(ORDER_ITEM_STATUSES).find(status => status.value === value);
}

export function getOrderTypeByValue(value: string): OrderTypeConfig | undefined {
  return Object.values(ORDER_TYPES).find(type => type.value === value);
}

export function getActiveOrderStatuses(): OrderStatusConfig[] {
  return Object.values(ORDER_STATUSES).filter(status => status.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getActiveOrderItemStatuses(): OrderStatusConfig[] {
  return Object.values(ORDER_ITEM_STATUSES).filter(status => status.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function isValidOrderTransition(fromStatus: string, toStatus: string): boolean {
  const transitions: Record<string, string[]> = {
    [ORDER_STATUSES.DRAFT.value]: [ORDER_STATUSES.OPEN.value, ORDER_STATUSES.CANCELLED.value],
    [ORDER_STATUSES.OPEN.value]: [ORDER_STATUSES.COMPLETE.value, ORDER_STATUSES.CANCELLED.value],
    [ORDER_STATUSES.COMPLETE.value]: [], // Terminal state
    [ORDER_STATUSES.CANCELLED.value]: [], // Terminal state
  };
  
  return transitions[fromStatus]?.includes(toStatus) ?? false;
}
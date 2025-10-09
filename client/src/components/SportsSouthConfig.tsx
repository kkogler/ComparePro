import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Settings, TestTube } from "lucide-react";
import { buildVendorApiUrl } from "@/lib/vendor-utils";

interface SportsSouthConfigProps {
  vendor?: any;
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
  organizationSlug: string; // Required for API calls
}

export function SportsSouthConfig({ vendor, isOpen = false, onClose, onSuccess, organizationSlug }: SportsSouthConfigProps) {
  const [open, setOpen] = useState(isOpen);
  const [credentials, setCredentials] = useState({
    userName: vendor?.credentials?.userName || '',
    password: vendor?.credentials?.password || '',
    source: vendor?.credentials?.source || '',
    customerNumber: vendor?.credentials?.customerNumber || ''
  });
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  const saveCredentials = useMutation({
    mutationFn: async (creds: any) => {
      console.log('🔍 SPORTS SOUTH SAVE DEBUG:', {
        originalCreds: creds,
        vendorId: vendor?.id,
        vendorName: vendor?.name,
        vendorShortCode: vendor?.vendorShortCode
      });

      // Map camelCase field names to snake_case for database compatibility
      const mappedCreds = {
        user_name: creds.userName,        // userName → user_name
        customer_number: creds.customerNumber, // customerNumber → customer_number
        password: creds.password,
        source: creds.source
      };

      console.log('🔍 SPORTS SOUTH MAPPED CREDS:', mappedCreds);

      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(organizationSlug, vendor, 'credentials');
      console.log('🔍 SPORTS SOUTH API URL:', apiUrl);

      const response = await apiRequest(apiUrl, 'POST', mappedCreds);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ SPORTS SOUTH SAVE FAILED:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          vendorIdentifier,
          mappedCreds: Object.keys(mappedCreds)
        });
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    },
    onSuccess: () => {
      console.log('✅ SPORTS SOUTH SAVE: Credentials saved successfully');
      // Invalidate both query keys to ensure all components update, but keep modal open
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/vendors`] });
      queryClient.invalidateQueries({ queryKey: [`/org/${organizationSlug}/api/supported-vendors`] });
      toast({ title: "Success", description: "Sports South credentials saved successfully" });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('❌ SPORTS SOUTH SAVE ERROR:', error);
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save Sports South credentials. Please check the vendor configuration and try again.",
        variant: "destructive"
      });
    }
  });

  const testConnection = useMutation({
    mutationFn: async () => {
      console.log('🔍 SPORTS SOUTH TEST: Starting connection test');
      
      // ✅ STANDARDIZED: Use vendor utility to get correct identifier
      const apiUrl = buildVendorApiUrl(organizationSlug, vendor, 'test-connection');
      console.log('🔍 SPORTS SOUTH TEST API URL:', apiUrl);
      
      const response = await apiRequest(apiUrl, 'POST');
      const data = await response.json();
      return data;
    },
    onSuccess: (data: any) => {
      if (data.success) {
        toast({ title: "Success", description: data.message });
      } else {
        toast({
          title: "Connection Failed",
          description: data.message,
          variant: "destructive"
        });
      }
      setIsTestingConnection(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to test connection",
        variant: "destructive"
      });
      setIsTestingConnection(false);
    }
  });


  const handleSave = () => {
    saveCredentials.mutate(credentials);
  };

  const handleTestConnection = () => {
    setIsTestingConnection(true);
    testConnection.mutate();
  };

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // When closing, notify parent component
      onClose?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Settings className="h-3 w-3 mr-1" />
          Configure
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-[90vw] sm:max-w-[720px] md:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Sports South Connection Settings
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Autofill traps */}
          <div style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
            <input type="text" name="fake-username" autoComplete="username" />
            <input type="password" name="fake-password" autoComplete="current-password" />
          </div>
          
          <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
            <p><strong>Sports South Connection Credentials Required!</strong></p>
            <p>Contact Sports South to get your API credentials:</p>
            <ul className="list-disc ml-4 mt-1">
              <li>Customer Number (from Sports South)</li>
              <li>Username (can be same as Customer Number)</li>
              <li>Password for API access (from Sports South)</li>
              <li>Source code – Create a short ID your organization (e.g., PRC-COMP)</li>
            </ul>
            <p className="mt-2">Be sure to request access to inventory and pricing APIs</p>
          </div>
          
          <div>
            <Label htmlFor="customerNumber">Customer Number</Label>
            <Input
              id="customerNumber"
              type="text"
              value={credentials.customerNumber}
              onChange={(e) => setCredentials({ ...credentials, customerNumber: e.target.value })}
              placeholder="Your Customer Number"
              autoComplete="off"
            />
          </div>
          
          <div>
            <Label htmlFor="userName">Username</Label>
            <Input
              id="userName"
              type="text"
              value={credentials.userName}
              onChange={(e) => setCredentials({ ...credentials, userName: e.target.value })}
              placeholder="Your Sports South Username"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              readOnly
              onFocus={(e) => { (e.target as HTMLInputElement).readOnly = false; }}
            />
          </div>
          
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
              placeholder="Your Sports South Password"
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              readOnly
              onFocus={(e) => { (e.target as HTMLInputElement).readOnly = false; }}
            />
          </div>
          
          <div>
            <Label htmlFor="source">Source</Label>
            <Input
              id="source"
              type="text"
              value={credentials.source}
              onChange={(e) => setCredentials({ ...credentials, source: e.target.value })}
              placeholder="Enter your own short name or code for your store"
              autoComplete="off"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              onClick={handleTestConnection}
              disabled={isTestingConnection || !credentials.userName || !credentials.password || !credentials.customerNumber}
              variant="outline"
              className="flex-1"
            >
              <TestTube className="h-4 w-4 mr-2" />
              {isTestingConnection ? "Testing..." : "Test Connection"}
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={saveCredentials.isPending || !credentials.userName || !credentials.password || !credentials.customerNumber}
              className="flex-1"
            >
              {saveCredentials.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
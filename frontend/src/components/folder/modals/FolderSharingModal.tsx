/**
 * ----------------------------------------------------------------------------------
 * FolderSharingModal
 * ----------------------------------------------------------------------------------
 * - Modal for managing folder sharing and permissions
 * - Allows folder owners to search for users and grant/revoke access
 * - Shows current permissions and provides management interface
 * - Supports user search with debounced input
 * - Handles permission granting and revocation with optimistic updates
 */

import { useState, useEffect, useCallback } from "react";
import {
  getFolderPermissions,
  grantFolderPermission,
  revokeFolderPermission,
  searchUsers,
  type Folder,
  type FolderPermission,
  type User,
} from "../../../lib/folders";
import {
  X,
  Loader2,
  UserRound,
  Check,
  AlertCircle,
} from "lucide-react";

export interface FolderSharingModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  onPermissionsUpdated?: () => void;
}

interface SearchResult extends User {
  isLoading?: boolean;
  hasAccess?: boolean;
}

export default function FolderSharingModal({
  isOpen,
  onClose,
  folder,
  onPermissionsUpdated,
}: FolderSharingModalProps) {
  const [permissions, setPermissions] = useState<FolderPermission[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load permissions when modal opens
  useEffect(() => {
    if (isOpen && folder) {
      loadPermissions();
    } else {
      setPermissions([]);
      setSearchQuery("");
      setSearchResults([]);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, folder]);

  // Debounced user search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setIsSearching(true);
        setError(null);
        const users = await searchUsers(searchQuery.trim(), 10);

        const usersWithAccess = users.map((user) => ({
          ...user,
          hasAccess: permissions.some((p) => p.user.id === user.id),
        }));

        setSearchResults(usersWithAccess);
      } catch (err: any) {
        console.error("User search error:", err);
        let errorMessage = "Failed to search users";

        if (err.status === 404) {
          errorMessage = "User search service is not available";
        } else if (err.status === 403) {
          errorMessage = "You don't have permission to search users";
        } else if (err.status === 401) {
          errorMessage = "Please log in to search for users";
        } else if (err.status >= 500) {
          errorMessage = "Server error - please try again later";
        } else if (err.message) {
          errorMessage = `Search failed: ${err.message}`;
        }

        setError(errorMessage);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, permissions]);

  const loadPermissions = async () => {
    if (!folder) return;

    try {
      setIsLoadingPermissions(true);
      setError(null);
      const folderPermissions = await getFolderPermissions(folder.folder_id);
      setPermissions(folderPermissions);
    } catch {
      setError("Failed to load folder permissions");
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  const handleGrantAccess = async (user: User) => {
    if (!folder) return;

    try {
      setError(null);
      setSuccessMessage(null);

      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isLoading: true } : u
        )
      );

      await grantFolderPermission(folder.folder_id, {
        user_id: user.id,
        permission_type: "view",
      });

      const newPermission: FolderPermission = {
        folder: folder.folder_id,
        user: user,
        permission_type: "view",
        granted_at: new Date().toISOString(),
        granted_by: { id: 0, username: "You", email: "" },
      };

      setPermissions((prev) => [...prev, newPermission]);
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, hasAccess: true, isLoading: false }
            : u
        )
      );

      setSuccessMessage(`Access granted to ${user.username}`);
      onPermissionsUpdated?.();
    } catch {
      setError(`Failed to grant access to ${user.username}`);
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, isLoading: false } : u
        )
      );
    }
  };

  const handleRevokeAccess = async (permission: FolderPermission) => {
    if (!folder) return;

    try {
      setError(null);
      setSuccessMessage(null);

      await revokeFolderPermission(
        folder.folder_id,
        permission.user.id
      );

      setPermissions((prev) =>
        prev.filter((p) => p.user.id !== permission.user.id)
      );
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === permission.user.id
            ? { ...u, hasAccess: false }
            : u
        )
      );

      setSuccessMessage(
        `Access revoked from ${permission.user.username}`
      );
      onPermissionsUpdated?.();
    } catch {
      setError(
        `Failed to revoke access from ${permission.user.username}`
      );
    }
  };

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  useEffect(() => {
    if (error || successMessage) {
      const timeoutId = setTimeout(clearMessages, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [error, successMessage, clearMessages]);

  if (!isOpen || !folder) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/10 p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Share Folder
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Manage access to "{folder.name}"
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Messages */}
          {(error || successMessage) && (
            <div className="border-b border-black/10 p-4">
              {error && (
                <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start text-sm text-red-700">
                      <AlertCircle className="mr-2 h-4 w-4 flex-shrink-0 text-red-500" />
                      <span>{error}</span>
                    </div>
                    <button
                      onClick={clearMessages}
                      className="rounded p-1 text-red-400 hover:text-red-600"
                      aria-label="Dismiss error"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
              {successMessage && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start text-sm text-green-700">
                      <Check className="mr-2 h-4 w-4 flex-shrink-0 text-green-600" />
                      <span>{successMessage}</span>
                    </div>
                    <button
                      onClick={clearMessages}
                      className="rounded p-1 text-green-400 hover:text-green-600"
                      aria-label="Dismiss success"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {/* User Search */}
            <div>
              <label
                htmlFor="userSearch"
                className="mb-2 block text-sm font-medium text-gray-900"
              >
                Add People
              </label>
              <div className="relative">
                <input
                  id="userSearch"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username or email..."
                  className="w-full rounded-md border border-black/10 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2.5">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  </div>
                )}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-md border border-black/10">
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between border-b border-black/10 p-3 last:border-b-0"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-700">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.username}
                          </div>
                          {user.email && (
                            <div className="text-xs text-gray-600">
                              {user.email}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        {user.hasAccess ? (
                          <span className="text-xs font-medium text-green-600">
                            Has Access
                          </span>
                        ) : (
                          <button
                            onClick={() => handleGrantAccess(user)}
                            disabled={user.isLoading}
                            className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {user.isLoading ? "Adding..." : "Add"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 &&
                !isSearching &&
                searchResults.length === 0 && (
                  <div className="mt-3 py-4 text-center text-sm text-gray-600">
                    No users found matching "{searchQuery}"
                  </div>
                )}
            </div>

            {/* Current Permissions */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900">
                  People with Access
                </h3>
                {isLoadingPermissions && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                )}
              </div>

              {permissions.length === 0 && !isLoadingPermissions ? (
                <div className="rounded-md border border-black/10 py-8 text-center text-sm text-gray-600">
                  No one else has access to this folder
                </div>
              ) : (
                <div className="space-y-2">
                  {permissions.map((permission) => (
                    <div
                      key={permission.user.id}
                      className="flex items-center justify-between rounded-md border border-black/10 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-700">
                          <UserRound className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {permission.user.username}
                          </div>
                          {permission.user.email && (
                            <div className="text-xs text-gray-600">
                              {permission.user.email}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs capitalize text-gray-600">
                          {permission.permission_type}
                        </span>
                        <button
                          onClick={() => handleRevokeAccess(permission)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sharing Info */}
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <div className="text-sm text-blue-800">
                <div className="mb-1 font-medium">
                  About Folder Sharing
                </div>
                <ul className="space-y-1 text-xs text-blue-700">
                  <li>• People with access can view all items in this folder</li>
                  <li>• They will also gain access to individual items within the folder</li>
                  <li>• Only you can add or remove items from this folder</li>
                  <li>• Folder privacy settings still apply to public visibility</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-black/10 bg-gray-50 p-6 text-right">
          <button
            onClick={onClose}
            className="rounded-md border border-black/10 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

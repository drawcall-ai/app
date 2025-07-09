import { useSession, authClient } from "../auth-client.js";

interface UserProfileProps {
  onAuthClick: () => void;
}

export function UserProfile({ onAuthClick }: UserProfileProps) {
  const { data: session, isPending } = useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
  };

  if (isPending) {
    return (
      <div className="flex items-center">
        <div className="text-sm">Loading...</div>
      </div>
    );
  }

  if (session == null || session.user.isAnonymous) {
    return (
      <button
        onClick={onAuthClick}
        className="px-3 py-1 text-sm border border-gray-600 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Sign In
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div
        onClick={() => authClient.customer.portal()}
        className="cursor-pointer flex items-center gap-2"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-sm font-medium">
              {session.user.name?.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-sm font-medium">{session.user.name}</span>
      </div>
      <button
        onClick={handleSignOut}
        className="px-3 py-1 text-sm border border-gray-600 rounded-md hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Sign Out
      </button>
    </div>
  );
}

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useMe, useLogout } from '@/hooks/use-auth';
import { LoginOverlay } from '@/components/auth/LoginOverlay';
import { MainMenu } from '@/components/game/MainMenu';
import { GameCanvas } from '@/components/game/GameCanvas';

type GameScreen = 'menu' | 'playing';

export default function Game() {
  const { ready: privyReady, logout: privyLogout } = usePrivy();
  const { data: user, isLoading: isAuthLoading } = useMe();
  const logoutMutation = useLogout();
  const [screen, setScreen] = useState<GameScreen>('menu');
  const [selectedAircraft, setSelectedAircraft] = useState<string>('fighter');

  // Handle logout - clear session and logout from Privy
  const handleLogout = async () => {
    try {
      // Clear backend session and invalidate cache
      await logoutMutation.mutateAsync();
    } catch (error) {
      console.error('Error clearing session:', error);
    }
    // Logout from Privy
    await privyLogout();
  };

  // Wait for Privy to be ready
  if (!privyReady || isAuthLoading) {
    return (
      <div className="h-screen w-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-cyan-400 font-mono animate-pulse">
            INITIALIZING SYSTEMS...
          </p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginOverlay />;
  }

  // Game screens
  if (screen === 'playing') {
    return (
      <div className="h-screen w-screen">
        <GameCanvas 
          onExit={() => setScreen('menu')}
          aircraftType={selectedAircraft}
        />
      </div>
    );
  }

  // Main menu
  return (
    <MainMenu
      username={user.username || `Pilot_${user.walletAddress?.slice(0, 6)}`}
      onStartGame={(aircraft) => {
        setSelectedAircraft(aircraft);
        setScreen('playing');
      }}
      onLogout={handleLogout}
    />
  );
}

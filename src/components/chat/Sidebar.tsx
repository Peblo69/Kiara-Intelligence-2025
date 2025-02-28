import React, { useState, useEffect } from 'react';
import { Brain, ChevronLeft, CreditCard, FileText, LogOut, Menu, Plus, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useStore } from '../../lib/store';
import { ChatItem } from '../ChatItem';
import { adminService } from '../../lib/admin';

interface SidebarProps {
  isLoading: boolean;
  handleNewChat: () => void;
}

export function Sidebar({ isLoading, handleNewChat }: SidebarProps) {
  const { 
    chats,
    activeChat,
    activeModel,
    setActiveModel,
    setIsAuthenticated,
    setIsSettingsOpen,
    setIsPricingOpen,
    setIsDocsOpen
  } = useStore();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768); // Default open on desktop
  const isDominator = activeModel === 'dominator';

  useEffect(() => {
    const checkAdmin = async () => {
      const isAdmin = await adminService.checkAdminStatus();
      setIsAdmin(isAdmin);
    };
    checkAdmin();

    // Handle window resize
    const handleResize = () => {
      setIsSidebarOpen(window.innerWidth >= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-black/20 backdrop-blur-sm text-white hover:bg-black/30 transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sidebar overlay for mobile */}
      {isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 w-64 bg-[var(--bg-darker)] border-r border-red-900/20
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:transition-none
      `}>
        <div className="flex flex-col h-full">
          <div className="p-3">
            <button 
              className="sidebar-item mb-2 w-full text-xs flex items-center"
              onClick={toggleSidebar}
            >
              <ChevronLeft className="w-3 h-3 mr-2" />
              <span>Kiara Intelligence</span>
            </button>
            <button 
              className={`sidebar-item w-full ${
                isDominator ? 'bg-red-900/20 hover:bg-red-900/30' : 'bg-purple-900/20 hover:bg-purple-900/30'
              } text-xs ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleNewChat}
              disabled={isLoading}
            >
              <Plus className="w-3 h-3 mr-2" />
              <span>New Chat</span>
            </button>
          </div>

          <div className="chat-list-container flex-1 overflow-y-auto">
            <div className="chat-list">
              {chats.filter(chat => chat.model === activeModel).length > 0 && (
                <div className="mb-3">
                  <h3 className={`px-3 py-1 text-[10px] font-semibold ${
                    isDominator ? "text-red-400" : "text-purple-400"
                  } uppercase tracking-wider`}>
                    Recent Chats
                  </h3>
                  <div className="space-y-0.5">
                    {chats
                      .filter(chat => chat.model === activeModel)
                      .map((chat) => (
                        <ChatItem
                          key={chat.id}
                          id={chat.id}
                          title={chat.title}
                          isActive={chat.id === activeChat}
                        />
                      ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <h3 className={`px-3 py-1 text-[10px] font-semibold ${
                  isDominator ? "text-red-400" : "text-purple-400"
                } uppercase tracking-wider`}>
                  Models
                </h3>
                <button 
                  className={`sidebar-item w-full ${activeModel === 'dominator' ? 'active bg-red-900/30' : ''} text-xs`}
                  onClick={() => setActiveModel('dominator')}
                >
                  <Brain className="w-3 h-3 mr-2" />
                  <span>Kiara Dominator X+</span>
                </button>
                <button 
                  className={`sidebar-item w-full ${activeModel === 'vision' ? 'active bg-purple-900/30' : ''} text-xs`}
                  onClick={() => setActiveModel('vision')}
                >
                  <Sparkles className="w-3 h-3 mr-2" />
                  <span>Kiara Vision X</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-auto p-2 border-t border-red-900/20">
            <button 
              onClick={() => setIsPricingOpen(true)}
              className={`sidebar-item w-full text-xs ${isDominator ? 'text-red-400 hover:bg-red-900/20' : 'text-purple-400 hover:bg-purple-900/20'}`}
            >
              <CreditCard className="w-3 h-3 mr-2" />
              <span>Pricing</span>
            </button>
            <button 
              onClick={() => setIsDocsOpen(true)}
              className={`sidebar-item w-full text-xs ${isDominator ? 'text-red-400 hover:bg-red-900/20' : 'text-purple-400 hover:bg-purple-900/20'}`}
            >
              <FileText className="w-3 h-3 mr-2" />
              <span>Docs</span>
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`sidebar-item w-full text-xs ${isDominator ? 'text-red-400 hover:bg-red-900/20' : 'text-purple-400 hover:bg-purple-900/20'}`}
            >
              <SettingsIcon className="w-3 h-3 mr-2" />
              <span>Settings</span>
            </button>
            <button 
              onClick={() => setIsAuthenticated(false)}
              className="sidebar-item w-full text-xs text-red-400 hover:bg-red-900/30"
            >
              <LogOut className="w-3 h-3 mr-2" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, MoreVertical, Pencil, Trash } from 'lucide-react';
import { useStore } from '../lib/store';

interface ChatItemProps {
  id: string;
  title: string;
  isActive: boolean;
}

export function ChatItem({ id, title, isActive }: ChatItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [showMenu, setShowMenu] = useState(false);
  const { setActiveChat, deleteChat, updateChatTitle } = useStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      setActiveChat(id);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleDelete = () => {
    deleteChat(id);
    setShowMenu(false);
  };

  const handleSave = () => {
    if (editedTitle.trim()) {
      updateChatTitle(id, editedTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedTitle(title);
    }
  };

  return (
    <div className="relative group">
      <div 
        className={`sidebar-item w-full text-xs flex items-center justify-between ${
          isActive ? 'bg-red-900/30 text-red-400' : ''
        }`}
        onClick={handleClick}
      >
        <div className="flex items-center flex-1 min-w-0">
          <MessageSquare className="w-3 h-3 mr-2 flex-shrink-0" />
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent border-b border-red-500/30 focus:border-red-500 outline-none px-1"
            />
          ) : (
            <span className="truncate">{title}</span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(true);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/30 transition-opacity"
        >
          <MoreVertical className="w-3 h-3" />
        </button>
      </div>
      
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 py-1 rounded-lg shadow-lg z-10 bg-[#1a0000] border border-red-900/20"
        >
          <button
            onClick={handleEdit}
            className="w-full text-left px-4 py-1.5 text-xs hover:bg-red-900/20 flex items-center"
          >
            <Pencil className="w-3 h-3 mr-2" />
            Rename
          </button>
          <button
            onClick={handleDelete}
            className="w-full text-left px-4 py-1.5 text-xs hover:bg-red-900/20 text-red-400 flex items-center"
          >
            <Trash className="w-3 h-3 mr-2" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
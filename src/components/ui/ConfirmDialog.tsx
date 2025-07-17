'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  if (!isOpen || typeof window === 'undefined') return null;

  const dialogContent = (
    <div 
      className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-[9999] backdrop-blur-sm"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={handleBackdropClick}
    >
      <div 
        ref={dialogRef}
        className="bg-white dark:bg-gray-900 p-8 max-w-md w-full mx-4 shadow-sm border border-gray-200 dark:border-gray-700 animate-fade-in"
        style={{ 
          borderRadius: 0,
          position: 'relative',
          margin: 'auto',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          {title}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="px-8 py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 border border-gray-200 dark:border-gray-700 hover:border-gray-900 dark:hover:border-gray-100 transition-all duration-200 lowercase tracking-wide"
            style={{ borderRadius: 0 }}
          >
            {cancelText.toLowerCase()}
          </button>
          <button
            onClick={handleConfirm}
            className={confirmButtonClass || "px-8 py-3 text-sm font-medium bg-[#87A96B] hover:bg-[#6e8a57] text-white border border-[#87A96B] hover:border-[#6e8a57] transition-all duration-200 lowercase tracking-wide"}
            style={{ borderRadius: 0 }}
          >
            {confirmText.toLowerCase()}
          </button>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document.body level
  return mounted.current ? createPortal(dialogContent, document.body) : null;
}
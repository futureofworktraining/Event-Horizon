"use client";

import React, { useState } from 'react';
import { Hexagon, Lightbulb, BookOpen, User, Eye, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function FloatingNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  // Satellite buttons configuration
  const satellites = [
    { icon: <Lightbulb className="w-5 h-5" />, label: "Ideas", angle: -90, color: "text-amber-500" }, // Top
    { icon: <BookOpen className="w-5 h-5" />, label: "Docs", angle: 0, color: "text-blue-500" },      // Right
    { icon: <User className="w-5 h-5" />, label: "Profile", angle: 90, color: "text-green-500" },     // Bottom
    { icon: <Eye className="w-5 h-5" />, label: "View", angle: 180, color: "text-purple-500" },       // Left
  ];

  const radius = 80; // Distance from center

  return (
    <div className="hidden md:flex fixed bottom-32 right-32 z-[60] items-center justify-center pointer-events-none">
      <div className="relative flex items-center justify-center pointer-events-auto">
        
        {/* Connection Circles/Rings when open */}
        <div 
          className={cn(
            "absolute inset-0 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 transition-all duration-300 ease-out flex items-center justify-center",
            isOpen ? "w-64 h-64 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 opacity-100" : "w-0 h-0 opacity-0"
          )}
        />
        
        <div 
          className={cn(
            "absolute inset-0 rounded-full border border-zinc-100 dark:border-zinc-800 transition-all duration-500 ease-out delay-75 flex items-center justify-center",
            isOpen ? "w-40 h-40 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2 opacity-100" : "w-0 h-0 opacity-0"
          )}
        />

        {/* Consulting Tooltip - Visible when open or hovered? Image shows it static. 
            Let's make it appear when hovering the main button, or persistent if that matches the "Consulting" label in the image.
            The image shows "Consulting" in a dark tooltip pointing to the center.
        */}
        <div 
          className={cn(
            "absolute -top-16 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap transition-all duration-300 transform",
            isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          Training
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-900"></div>
        </div>

        {/* Main Toggle Button */}
        <Button
          onClick={toggleOpen}
          className={cn(
            "w-14 h-14 rounded-full shadow-2xl relative z-20 flex items-center justify-center transition-all duration-300",
            isOpen ? "bg-zinc-900 rotate-45" : "bg-cyan-500 hover:bg-cyan-600 rotate-0"
          )}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Hexagon className="w-6 h-6 text-white fill-white" />
          )}
        </Button>

        {/* Satellite Buttons */}
        {satellites.map((satellite, index) => {
          // Calculate individual positions based on angle
          // We want them to animate out from center
          const angleRad = (satellite.angle * Math.PI) / 180;
          const x = isOpen ? Math.cos(angleRad) * radius : 0;
          const y = isOpen ? Math.sin(angleRad) * radius : 0;

          return (
            <button
              key={index}
              className={cn(
                "absolute w-12 h-12 bg-white dark:bg-zinc-900 rounded-full shadow-lg border border-zinc-100 dark:border-zinc-800 flex items-center justify-center transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) z-10 hover:scale-110",
                isOpen ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"
              )}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              title={satellite.label}
            >
              <div className={cn("transition-colors duration-200", satellite.color)}>
                {satellite.icon}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

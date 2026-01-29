"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ListGroupHeaderProps {
  groupKey: string;
  label: string;
  color?: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  colSpan: number;
}

export function ListGroupHeader({
  groupKey,
  label,
  color,
  count,
  isCollapsed,
  onToggle,
  colSpan,
}: ListGroupHeaderProps) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={colSpan} className="py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-2 font-medium"
          onClick={onToggle}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {color && (
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          {label}
          <Badge variant="secondary" className="ml-1 font-normal">
            {count}
          </Badge>
        </Button>
      </TableCell>
    </TableRow>
  );
}

'use client';

import * as React from 'react';
import type {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  ArrowDown,
  ArrowUp,
  FileDown,
  Plus,
  Settings2,
  Trash2,
} from 'lucide-react';

const SELECTION_COLUMN_ID = 'select';

type CustomizableColumn = {
  id: string;
  label: string;
  defaultVisible?: boolean;
};

type StoredColumnPreferences = {
  order?: string[];
  visibility?: Record<string, boolean>;
};

function getColumnId<TData, TValue>(
  column: ColumnDef<TData, TValue>,
  index: number,
) {
  if ('id' in column && typeof column.id === 'string') {
    return column.id;
  }

  if ('accessorKey' in column && typeof column.accessorKey === 'string') {
    return column.accessorKey;
  }

  return `column-${index}`;
}

function readStoredColumnPreferences(storageKey?: string) {
  if (!storageKey || typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredColumnPreferences;
  } catch {
    return null;
  }
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  customizableColumns?: CustomizableColumn[];
  columnPreferencesKey?: string;
  data: TData[];
  onNewPost?: () => void;
  onImportMarkdown?: () => void;
  onEdit?: (postSlug: string) => void;
  onDeleteSelected?: (postSlugs: string[]) => void;
  getRowSlug: (row: TData) => string;
}

export function DataTable<TData, TValue>({
  columns,
  customizableColumns = [],
  columnPreferencesKey,
  data,
  onNewPost,
  onImportMarkdown,
  onEdit,
  onDeleteSelected,
  getRowSlug,
}: DataTableProps<TData, TValue>) {
  const customizableColumnIds = React.useMemo(
    () => customizableColumns.map((column) => column.id),
    [customizableColumns],
  );
  const defaultColumnVisibility = React.useMemo<VisibilityState>(
    () =>
      Object.fromEntries(
        customizableColumns.map((column) => [
          column.id,
          column.defaultVisible ?? true,
        ]),
      ),
    [customizableColumns],
  );
  const storedPreferences = React.useMemo(
    () => readStoredColumnPreferences(columnPreferencesKey),
    [columnPreferencesKey],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    () => ({
      ...defaultColumnVisibility,
      ...(storedPreferences?.visibility ?? {}),
    }),
  );
  const [customColumnOrder, setCustomColumnOrder] = React.useState<string[]>(
    () => storedPreferences?.order ?? customizableColumnIds,
  );

  const selectionColumn = React.useMemo<ColumnDef<TData, unknown>>(
    () => ({
      id: SELECTION_COLUMN_ID,
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
          onClick={(e) => e.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label='Select row'
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    [],
  );

  const allColumns = React.useMemo(
    () => [selectionColumn, ...columns],
    [columns, selectionColumn],
  );
  const dataColumnIds = React.useMemo(
    () => columns.map((column, index) => getColumnId(column, index)),
    [columns],
  );
  const fixedColumnIds = React.useMemo(
    () =>
      dataColumnIds.filter((columnId) => !customizableColumnIds.includes(columnId)),
    [customizableColumnIds, dataColumnIds],
  );
  const orderedCustomizableColumns = React.useMemo(() => {
    const visibleCustomIds = customColumnOrder.filter((columnId) =>
      customizableColumnIds.includes(columnId),
    );
    const missingIds = customizableColumnIds.filter(
      (columnId) => !visibleCustomIds.includes(columnId),
    );
    const orderedIds = [...visibleCustomIds, ...missingIds];

    return orderedIds
      .map((columnId) =>
        customizableColumns.find((column) => column.id === columnId),
      )
      .filter((column): column is CustomizableColumn => column !== undefined);
  }, [customColumnOrder, customizableColumnIds, customizableColumns]);
  const effectiveColumnOrder = React.useMemo(
    () => [
      SELECTION_COLUMN_ID,
      ...fixedColumnIds,
      ...orderedCustomizableColumns.map((column) => column.id),
    ],
    [fixedColumnIds, orderedCustomizableColumns],
  );
  const effectiveColumnVisibility = React.useMemo(
    () => ({
      ...defaultColumnVisibility,
      ...columnVisibility,
    }),
    [columnVisibility, defaultColumnVisibility],
  );

  React.useEffect(() => {
    if (!columnPreferencesKey || typeof window === 'undefined') {
      return;
    }

    const storedVisibility = orderedCustomizableColumns.reduce<
      Record<string, boolean>
    >((acc, column) => {
      acc[column.id] = effectiveColumnVisibility[column.id] !== false;
      return acc;
    }, {});

    window.localStorage.setItem(
      columnPreferencesKey,
      JSON.stringify({
        order: orderedCustomizableColumns.map((column) => column.id),
        visibility: storedVisibility,
      } satisfies StoredColumnPreferences),
    );
  }, [
    columnPreferencesKey,
    effectiveColumnVisibility,
    orderedCustomizableColumns,
  ]);

  const table = useReactTable({
    data,
    columns: allColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnOrder: effectiveColumnOrder,
      columnVisibility: effectiveColumnVisibility,
      rowSelection,
    },
  });

  const selectedRows = table.getSelectedRowModel().rows;
  const selectedSlugs = selectedRows.map((row) => getRowSlug(row.original));
  const hasSelection = selectedRows.length > 0;

  const handleRowClick = (row: { original: TData }) => {
    const slug = getRowSlug(row.original);
    if (onEdit && slug) {
      onEdit(slug);
    }
  };

  const handleDeleteSelected = () => {
    if (onDeleteSelected && selectedSlugs.length > 0) {
      onDeleteSelected(selectedSlugs);
    }
  };

  const handleVisibilityChange = React.useCallback((columnId: string) => {
    setColumnVisibility((current) => ({
      ...current,
      [columnId]: current[columnId] === false,
    }));
  }, []);

  const handleMoveColumn = React.useCallback(
    (columnId: string, direction: 'up' | 'down') => {
      setCustomColumnOrder((current) => {
        const normalized = [
          ...current.filter((id) => customizableColumnIds.includes(id)),
          ...customizableColumnIds.filter((id) => !current.includes(id)),
        ];
        const fromIndex = normalized.indexOf(columnId);
        if (fromIndex === -1) {
          return normalized;
        }

        const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= normalized.length) {
          return normalized;
        }

        const next = [...normalized];
        const [movedColumn] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, movedColumn);
        return next;
      });
    },
    [customizableColumnIds],
  );

  const resetColumnPreferences = React.useCallback(() => {
    setColumnVisibility(defaultColumnVisibility);
    setCustomColumnOrder(customizableColumnIds);
  }, [customizableColumnIds, defaultColumnVisibility]);

  return (
    <div className='flex h-full min-h-0 flex-col gap-4'>
      <div className='flex shrink-0 items-center gap-2 pt-0 pb-4'>
        <Input
          placeholder='Filter posts by title...'
          value={(table.getColumn('title')?.getFilterValue() as string) ?? ''}
          onChange={(event) =>
            table.getColumn('title')?.setFilterValue(event.target.value)
          }
          className='max-w-sm'
        />
        {hasSelection && onDeleteSelected && (
          <Button
            variant='destructive'
            onClick={handleDeleteSelected}
            className='whitespace-nowrap'
          >
            <Trash2 size={16} className='mr-1' />
            Delete ({selectedSlugs.length})
          </Button>
        )}
        <div className='flex items-center gap-2 ml-auto'>
          {orderedCustomizableColumns.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant='outline' className='whitespace-nowrap'>
                  <Settings2 size={16} className='mr-1' />
                  Customize Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align='end' className='w-80 p-0'>
                <div className='border-b px-4 py-3'>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <p className='text-sm font-semibold'>Table columns</p>
                      <p className='text-xs text-muted-foreground'>
                        Show, hide, and reorder the optional post properties.
                      </p>
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 px-2'
                      onClick={resetColumnPreferences}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
                <div className='max-h-80 space-y-1 overflow-y-auto p-2'>
                  {orderedCustomizableColumns.map((column, index) => {
                    const isVisible =
                      effectiveColumnVisibility[column.id] !== false;

                    return (
                      <div
                        key={column.id}
                        className='flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50'
                      >
                        <Checkbox
                          id={`column-${column.id}`}
                          checked={isVisible}
                          onCheckedChange={() =>
                            handleVisibilityChange(column.id)
                          }
                          aria-label={`Toggle ${column.label} column`}
                        />
                        <label
                          htmlFor={`column-${column.id}`}
                          className='flex-1 cursor-pointer text-sm font-medium'
                        >
                          {column.label}
                        </label>
                        <div className='flex items-center gap-1'>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            onClick={() => handleMoveColumn(column.id, 'up')}
                            disabled={index === 0}
                            aria-label={`Move ${column.label} up`}
                          >
                            <ArrowUp />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-sm'
                            onClick={() => handleMoveColumn(column.id, 'down')}
                            disabled={
                              index === orderedCustomizableColumns.length - 1
                            }
                            aria-label={`Move ${column.label} down`}
                          >
                            <ArrowDown />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {onImportMarkdown && (
            <Button
              variant='outline'
              onClick={onImportMarkdown}
              className='whitespace-nowrap'
            >
              <FileDown size={16} className='mr-1' />
              Import Markdown
            </Button>
          )}
          {onNewPost && (
            <Button onClick={onNewPost} className='whitespace-nowrap'>
              <Plus size={16} className='mr-1' />
              New Post
            </Button>
          )}
        </div>
      </div>
      <div className='min-h-0 flex-1 overflow-hidden rounded-md border'>
        <ScrollArea className='h-full w-full'>
          <div className='w-full'>
            <Table className='w-full min-w-max'>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      tabIndex={0}
                      onClick={() => handleRowClick(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRowClick(row);
                        }
                      }}
                      className='cursor-pointer transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length + 1}
                      className='h-24 text-center'
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation='horizontal' className='[&_[data-slot=scroll-area-thumb]]:bg-foreground/15' />
          <ScrollBar orientation='vertical' className='[&_[data-slot=scroll-area-thumb]]:bg-foreground/15' />
        </ScrollArea>
      </div>
      <div className='flex shrink-0 items-center justify-end space-x-2 py-4'>
        <div className='flex-1 text-sm text-muted-foreground'>
          {hasSelection
            ? `${selectedSlugs.length} of ${table.getFilteredRowModel().rows.length} row(s) selected.`
            : `${table.getFilteredRowModel().rows.length} post(s) total.`}
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant='outline'
          size='sm'
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

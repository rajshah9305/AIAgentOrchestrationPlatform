"use client"

import * as React from "react"
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts"

import { cn } from "@/lib/utils"

const THEMES = {
  light: {
    background: "transparent",
    text: "hsl(var(--chart-1))",
    grid: "hsl(var(--chart-grid))",
    tooltip: {
      background: "hsl(var(--background))",
      border: "hsl(var(--border))",
      text: "hsl(var(--foreground))",
    },
  },
  dark: {
    background: "transparent",
    text: "hsl(var(--chart-1))",
    grid: "hsl(var(--chart-grid))",
    tooltip: {
      background: "hsl(var(--background))",
      border: "hsl(var(--border))",
      text: "hsl(var(--foreground))",
    },
  },
} as const

type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) {
    throw new Error("useChart must be used within a ChartProvider")
  }
  return context
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const theme = "dark" // You can make this dynamic
  const themeConfig = THEMES[theme as keyof typeof THEMES]

  return (
    <style
      id={id}
      dangerouslySetInnerHTML={{
        __html: `
          .recharts-cartesian-grid-horizontal line,
          .recharts-cartesian-grid-vertical line {
            stroke: ${themeConfig.grid};
          }
          .recharts-cartesian-axis-tick-value {
            fill: ${themeConfig.text};
          }
          .recharts-cartesian-axis-label {
            fill: ${themeConfig.text};
          }
          .recharts-legend-item-text {
            color: ${themeConfig.text} !important;
          }
          .recharts-tooltip-wrapper {
            background: ${themeConfig.tooltip.background};
            border: 1px solid ${themeConfig.tooltip.border};
            border-radius: 6px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          }
          .recharts-tooltip-label {
            color: ${themeConfig.tooltip.text};
          }
          .recharts-tooltip-item {
            color: ${themeConfig.tooltip.text};
          }
        `,
      }}
    />
  )
}

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (!payload || typeof payload !== "object") return null

  const payloadKey = key as keyof typeof payload
  const value = payload[payloadKey]

  if (!value || typeof value !== "string") return null

  return config[value] || null
}

interface ChartProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig
}

const Chart = React.forwardRef<HTMLDivElement, ChartProps>(
  ({ config, className, children, ...props }, ref) => {
    const id = React.useId()

    return (
      <ChartContext.Provider value={{ config }}>
        <div ref={ref} className={cn("space-y-4", className)} {...props}>
          <ChartStyle id={id} config={config} />
          {children}
        </div>
      </ChartContext.Provider>
    )
  }
)
Chart.displayName = "Chart"

interface ChartHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
}

const ChartHeader = React.forwardRef<HTMLDivElement, ChartHeaderProps>(
  ({ title, description, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)} {...props}>
        {title && (
          <h3 className="text-lg font-semibold leading-none tracking-tight">
            {title}
          </h3>
        )}
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    )
  }
)
ChartHeader.displayName = "ChartHeader"

interface ChartContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ChartContent = React.forwardRef<HTMLDivElement, ChartContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-4", className)} {...props}>
        {children}
      </div>
    )
  }
)
ChartContent.displayName = "ChartContent"

interface ChartTooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean
  payload?: any[]
  label?: string
}

const ChartTooltip = React.forwardRef<HTMLDivElement, ChartTooltipProps>(
  ({ active, payload, label, className, ...props }, ref) => {
    const { config } = useChart()

    if (!active || !payload) {
      return null
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-background p-2 shadow-sm",
          className
        )}
        {...props}
      >
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="font-medium">{label}</div>
            </div>
          </div>
          <div className="grid gap-1">
            {payload.map((item: any, index: number) => {
              const configItem = getPayloadConfigFromPayload(
                config,
                item,
                "dataKey"
              )
              if (!configItem) return null

              return (
                <div key={index} className="flex items-center gap-2">
                  {configItem.icon && (
                    <configItem.icon className="h-4 w-4" />
                  )}
                  <span className="flex-1 text-sm text-muted-foreground">
                    {configItem.label}
                  </span>
                  <span className="text-sm font-medium">
                    {item.value?.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }
)
ChartTooltip.displayName = "ChartTooltip"

export {
  Chart,
  ChartHeader,
  ChartContent,
  ChartTooltip,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
}

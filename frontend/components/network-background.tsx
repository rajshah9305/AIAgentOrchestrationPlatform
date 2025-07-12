"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import { Points, PointMaterial, Line } from "@react-three/drei"
import type * as THREE from "three"

export function NetworkBackground() {
  const pointsRef = useRef<THREE.Points>(null)
  const linesRef = useRef<THREE.Group>(null)

  // Generate network nodes
  const nodes = useMemo(() => {
    const positions = new Float32Array(300)
    const colors = new Float32Array(300)

    for (let i = 0; i < 100; i++) {
      const i3 = i * 3
      positions[i3] = (Math.random() - 0.5) * 20
      positions[i3 + 1] = (Math.random() - 0.5) * 20
      positions[i3 + 2] = (Math.random() - 0.5) * 10

      // Orange color variations
      colors[i3] = 1.0 // R
      colors[i3 + 1] = 0.4 + Math.random() * 0.4 // G
      colors[i3 + 2] = 0.0 // B
    }

    return { positions, colors }
  }, [])

  // Generate connections between nearby nodes
  const connections = useMemo(() => {
    const lines = []
    const nodePositions = []

    for (let i = 0; i < nodes.positions.length; i += 3) {
      nodePositions.push([nodes.positions[i], nodes.positions[i + 1], nodes.positions[i + 2]])
    }

    for (let i = 0; i < nodePositions.length; i++) {
      for (let j = i + 1; j < nodePositions.length; j++) {
        const distance = Math.sqrt(
          Math.pow(nodePositions[i][0] - nodePositions[j][0], 2) +
            Math.pow(nodePositions[i][1] - nodePositions[j][1], 2) +
            Math.pow(nodePositions[i][2] - nodePositions[j][2], 2),
        )

        if (distance < 5 && Math.random() > 0.7) {
          lines.push([nodePositions[i], nodePositions[j]])
        }
      }
    }

    return lines
  }, [nodes])

  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.elapsedTime * 0.1
      pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.1
    }

    if (linesRef.current) {
      linesRef.current.rotation.y = state.clock.elapsedTime * 0.1
      linesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.1
    }
  })

  return (
    <group>
      {/* Network Nodes */}
      <Points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={nodes.positions.length / 3}
            array={nodes.positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={nodes.colors.length / 3}
            array={nodes.colors}
            itemSize={3}
          />
        </bufferGeometry>
        <PointMaterial size={0.1} vertexColors transparent opacity={0.8} sizeAttenuation={true} />
      </Points>

      {/* Network Connections */}
      <group ref={linesRef}>
        {connections.map((connection, index) => (
          <Line key={index} points={connection} color="#ff6b35" lineWidth={1} transparent opacity={0.3} />
        ))}
      </group>

      {/* Ambient particles */}
      <Points>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={200}
            array={new Float32Array(600).map(() => (Math.random() - 0.5) * 50)}
            itemSize={3}
          />
        </bufferGeometry>
        <PointMaterial size={0.02} color="#ff6b35" transparent opacity={0.4} sizeAttenuation={true} />
      </Points>
    </group>
  )
}

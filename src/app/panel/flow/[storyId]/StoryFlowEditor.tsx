'use client'

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  Handle,
  Position,
  NodeProps,
  BackgroundVariant,
  NodeChange
} from 'reactflow'
import 'reactflow/dist/style.css'
import { createClient } from '@/lib/supabase/client'
import { 
  ArrowLeft, 
  Save, 
  Edit3, 
  Check,
  GitBranch,
  Play,
  Loader2,
  CheckCircle
} from 'lucide-react'
import type { Story, Scene, Choice, Panel, ScenePosition } from '@/types/database'

interface SceneWithPanels extends Scene {
  panels: Panel[]
}

interface StoryFlowEditorProps {
  story: Story
  initialScenes: SceneWithPanels[]
  initialChoices: Choice[]
  initialPositions: ScenePosition[]
}

// Custom Scene Node Component
const SceneNode = ({ data, selected }: NodeProps) => {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(data.title)

  const handleSave = () => {
    if (title.trim()) {
      data.onTitleChange(data.id, title.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setTitle(data.title)
      setIsEditing(false)
    }
  }

  return (
    <div 
      className={`bg-gray-800 rounded-lg overflow-hidden shadow-xl border-2 transition-all ${
        selected ? 'border-blue-500 shadow-blue-500/30' : 'border-gray-700 hover:border-gray-600'
      } ${data.isStartScene ? 'ring-2 ring-green-500 ring-offset-2 ring-offset-gray-900' : ''}`}
      style={{ width: 200 }}
    >
      {/* Scene Image */}
      {data.imageUrl && (
        <div className="relative h-28 overflow-hidden">
          <img 
            src={data.imageUrl} 
            alt={data.title} 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-800/80 to-transparent" />
          
          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1">
            {data.isStartScene && (
              <span className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                <Play size={8} /> Başlangıç
              </span>
            )}
            {data.isDecisionScene && (
              <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                <GitBranch size={8} /> Karar
              </span>
            )}
          </div>

          {/* Panel count */}
          <div className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
            {data.panelCount} panel
          </div>
        </div>
      )}

      {/* Scene Title */}
      <div className="p-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSave}
              autoFocus
              className="flex-1 bg-gray-700 text-white text-sm px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button onClick={handleSave} className="p-1 text-green-500 hover:bg-gray-700 rounded">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-medium truncate flex-1">{data.title}</h3>
            <button 
              onClick={() => setIsEditing(true)} 
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded ml-1"
            >
              <Edit3 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !w-3 !h-3 !border-2 !border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-500 !w-3 !h-3 !border-2 !border-gray-800"
      />
    </div>
  )
}

const nodeTypes = {
  sceneNode: SceneNode
}

export default function StoryFlowEditor({ story, initialScenes, initialChoices, initialPositions }: StoryFlowEditorProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [scenes, setScenes] = useState<SceneWithPanels[]>(initialScenes)
  const [choices, setChoices] = useState<Choice[]>(initialChoices)
  const [positions, setPositions] = useState<ScenePosition[]>(initialPositions)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [positionsSaved, setPositionsSaved] = useState(false)
  
  // Debounce timer for position saving
  const positionSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Handle title change
  const handleTitleChange = useCallback((sceneId: string, newTitle: string) => {
    setScenes(prev => prev.map(s => 
      s.id === sceneId ? { ...s, title: newTitle } : s
    ))
    setHasChanges(true)
  }, [])

  // Get initial position for a scene
  const getInitialPosition = useCallback((sceneId: string, index: number) => {
    const savedPosition = positions.find(p => p.scene_id === sceneId)
    if (savedPosition) {
      return { x: Number(savedPosition.position_x), y: Number(savedPosition.position_y) }
    }
    // Default grid layout
    return { 
      x: (index % 4) * 280 + 50, 
      y: Math.floor(index / 4) * 220 + 50 
    }
  }, [positions])

  // Convert scenes to nodes with saved positions
  const initialNodes: Node[] = useMemo(() => {
    return scenes.map((scene, index) => ({
      id: scene.id,
      type: 'sceneNode',
      position: getInitialPosition(scene.id, index),
      data: {
        id: scene.id,
        title: scene.title,
        imageUrl: scene.image_url,
        isStartScene: scene.is_start_scene,
        isDecisionScene: scene.is_decision_scene,
        panelCount: scene.panels?.length || 0,
        onTitleChange: handleTitleChange
      }
    }))
  }, [scenes, handleTitleChange, getInitialPosition])

  // Convert choices to edges
  const initialEdges: Edge[] = useMemo(() => {
    return choices.map(choice => {
      const isNormalFlow = !choice.choice_text || choice.choice_text.trim() === ''
      
      if (isNormalFlow) {
        return {
          id: choice.id,
          source: choice.from_scene_id,
          target: choice.to_scene_id,
          style: { stroke: '#22c55e', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: '#22c55e'
          },
          animated: false
        }
      }
      
      return {
        id: choice.id,
        source: choice.from_scene_id,
        target: choice.to_scene_id,
        label: choice.choice_text,
        labelStyle: { fill: '#fff', fontWeight: 500, fontSize: 11 },
        labelBgStyle: { fill: '#6b21a8', fillOpacity: 0.9 },
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
        style: { stroke: '#a855f7', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#a855f7'
        },
        animated: true
      }
    })
  }, [choices])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Save node positions to database (debounced)
  const savePositions = useCallback(async (nodesToSave: Node[]) => {
    try {
      for (const node of nodesToSave) {
        const existingPosition = positions.find(p => p.scene_id === node.id)
        
        if (existingPosition) {
          // Update existing position
          await supabase
            .from('scene_positions')
            .update({ 
              position_x: node.position.x, 
              position_y: node.position.y,
              updated_at: new Date().toISOString()
            })
            .eq('scene_id', node.id)
        } else {
          // Insert new position
          const { data } = await supabase
            .from('scene_positions')
            .insert({ 
              scene_id: node.id, 
              position_x: node.position.x, 
              position_y: node.position.y 
            })
            .select()
            .single()
          
          if (data) {
            setPositions(prev => [...prev, data])
          }
        }
      }
      
      setPositionsSaved(true)
      setTimeout(() => setPositionsSaved(false), 2000)
    } catch (err) {
      console.error('Error saving positions:', err)
    }
  }, [positions, supabase])

  // Custom onNodesChange that tracks position changes
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    
    // Check for position changes
    const positionChanges = changes.filter(c => c.type === 'position' && c.dragging === false)
    
    if (positionChanges.length > 0) {
      // Clear previous timer
      if (positionSaveTimerRef.current) {
        clearTimeout(positionSaveTimerRef.current)
      }
      
      // Debounce save
      positionSaveTimerRef.current = setTimeout(() => {
        // Get current node positions
        setNodes(currentNodes => {
          const movedNodeIds = positionChanges.map(c => 'id' in c ? c.id : null).filter(Boolean)
          const movedNodes = currentNodes.filter(n => movedNodeIds.includes(n.id))
          if (movedNodes.length > 0) {
            savePositions(movedNodes)
          }
          return currentNodes
        })
      }, 500)
    }
  }, [onNodesChange, savePositions, setNodes])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (positionSaveTimerRef.current) {
        clearTimeout(positionSaveTimerRef.current)
      }
    }
  }, [])

  // Update nodes when scenes change
  useEffect(() => {
    setNodes(prevNodes => {
      return scenes.map((scene, index) => {
        const existingNode = prevNodes.find(n => n.id === scene.id)
        return {
          id: scene.id,
          type: 'sceneNode',
          position: existingNode?.position || getInitialPosition(scene.id, index),
          data: {
            id: scene.id,
            title: scene.title,
            imageUrl: scene.image_url,
            isStartScene: scene.is_start_scene,
            isDecisionScene: scene.is_decision_scene,
            panelCount: scene.panels?.length || 0,
            onTitleChange: handleTitleChange
          }
        }
      })
    })
  }, [scenes, setNodes, handleTitleChange, getInitialPosition])

  // Handle new connection
  const onConnect = useCallback(async (params: Connection) => {
    if (!params.source || !params.target) return

    const exists = choices.some(c => 
      c.from_scene_id === params.source && c.to_scene_id === params.target
    )
    if (exists) return

    const sourceScene = scenes.find(s => s.id === params.source)
    
    const connectionType = prompt(
      'Bağlantı türü:\n\n' +
      '1) Normal akış (seçimsiz) → Boş bırakın veya "1" yazın\n' +
      '2) Seçim/Karar → Seçim metnini yazın\n\n' +
      'Seçiminiz:'
    )
    
    if (connectionType === null) return

    const isNormalFlow = connectionType.trim() === '' || connectionType.trim() === '1'
    const choiceText = isNormalFlow ? '' : connectionType.trim()

    const { data, error } = await supabase.from('choices').insert({
      from_scene_id: params.source,
      to_scene_id: params.target,
      choice_text: choiceText,
      order_index: choices.filter(c => c.from_scene_id === params.source).length
    }).select().single()

    if (!error && data) {
      setChoices(prev => [...prev, data])
      
      const edgeStyle = isNormalFlow ? {
        id: data.id,
        style: { stroke: '#22c55e', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#22c55e'
        },
        animated: false
      } : {
        id: data.id,
        label: choiceText,
        labelStyle: { fill: '#fff', fontWeight: 500, fontSize: 11 },
        labelBgStyle: { fill: '#6b21a8', fillOpacity: 0.9 },
        labelBgPadding: [8, 4] as [number, number],
        labelBgBorderRadius: 4,
        style: { stroke: '#a855f7', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#a855f7'
        },
        animated: true
      }

      setEdges(eds => addEdge({
        ...params,
        ...edgeStyle
      }, eds))
      
      if (!isNormalFlow && sourceScene && !sourceScene.is_decision_scene) {
        await supabase.from('scenes').update({ is_decision_scene: true }).eq('id', params.source)
        setScenes(prev => prev.map(s => 
          s.id === params.source ? { ...s, is_decision_scene: true } : s
        ))
      }
    }
  }, [choices, scenes, supabase, setEdges])

  // Handle edge delete
  const onEdgeClick = useCallback(async (_: React.MouseEvent, edge: Edge) => {
    const isNormalFlow = !edge.label
    const message = isNormalFlow 
      ? 'Bu bağlantıyı silmek istiyor musunuz?' 
      : `"${edge.label}" seçimini silmek istiyor musunuz?`
    
    if (!confirm(message)) return

    const { error } = await supabase.from('choices').delete().eq('id', edge.id)
    if (!error) {
      setChoices(prev => prev.filter(c => c.id !== edge.id))
      setEdges(eds => eds.filter(e => e.id !== edge.id))

      const remainingChoices = choices.filter(c => 
        c.from_scene_id === edge.source && 
        c.id !== edge.id && 
        c.choice_text && c.choice_text.trim() !== ''
      )
      if (remainingChoices.length === 0) {
        await supabase.from('scenes').update({ is_decision_scene: false }).eq('id', edge.source)
        setScenes(prev => prev.map(s => 
          s.id === edge.source ? { ...s, is_decision_scene: false } : s
        ))
      }
    }
  }, [choices, supabase, setEdges])

  // Save all changes
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      // Update scene titles
      for (const scene of scenes) {
        const original = initialScenes.find(s => s.id === scene.id)
        if (original && original.title !== scene.title) {
          await supabase.from('scenes').update({ title: scene.title }).eq('id', scene.id)
        }
      }
      
      // Save all current node positions
      await savePositions(nodes)
      
      setHasChanges(false)
    } catch (err) {
      console.error('Save error:', err)
      alert('Kaydetme hatası!')
    } finally {
      setSaving(false)
    }
  }, [scenes, initialScenes, supabase, savePositions, nodes])

  // Set start scene
  const handleSetStartScene = useCallback(async (sceneId: string) => {
    await supabase.from('scenes').update({ is_start_scene: false }).eq('story_id', story.id)
    const { error } = await supabase.from('scenes').update({ is_start_scene: true }).eq('id', sceneId)
    if (!error) {
      setScenes(prev => prev.map(s => ({ ...s, is_start_scene: s.id === sceneId })))
    }
  }, [story.id, supabase])

  // Context menu for nodes
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    const menu = document.getElementById('context-menu')
    if (menu) {
      menu.style.display = 'block'
      menu.style.left = `${event.clientX}px`
      menu.style.top = `${event.clientY}px`
      menu.setAttribute('data-node-id', node.id)
    }
  }, [])

  // Hide context menu on click elsewhere
  useEffect(() => {
    const handleClick = () => {
      const menu = document.getElementById('context-menu')
      if (menu) menu.style.display = 'none'
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/panel')} 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Geri</span>
          </button>
          <div className="w-px h-8 bg-gray-700" />
          <div>
            <h1 className="text-white font-bold">{story.title}</h1>
            <p className="text-gray-400 text-xs">Hikaye Akış Editörü</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Position saved indicator */}
          {positionsSaved && (
            <span className="text-green-400 text-sm flex items-center gap-1 animate-fadeIn">
              <CheckCircle size={14} /> Konumlar kaydedildi
            </span>
          )}
          {hasChanges && (
            <span className="text-yellow-500 text-sm">• Kaydedilmemiş değişiklikler</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="flex-shrink-0 bg-gray-800/50 border-b border-gray-700 px-4 py-2">
        <p className="text-gray-400 text-sm">
          <span className="text-purple-400 font-medium">İpucu:</span> Sahneleri bağlamak için alt noktadan üst noktaya sürükleyin. 
          <span className="text-green-400 mx-1">●</span>Yeşil = Normal akış 
          <span className="text-purple-400 mx-1">●</span>Mor = Seçim/Karar. 
          Bağlantıya tıklayarak silin. <span className="text-blue-400">Sahne konumları otomatik kaydedilir.</span>
        </p>
      </div>

      {/* Flow Editor */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeContextMenu={onNodeContextMenu}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          minZoom={0.3}
          maxZoom={2}
          defaultEdgeOptions={{
            style: { stroke: '#a855f7', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#a855f7'
            }
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
          <Controls 
            className="!bg-gray-800 !border-gray-700 !rounded-lg"
            showZoom
            showFitView
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {/* Context Menu */}
      <div 
        id="context-menu" 
        className="fixed hidden bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
      >
        <button
          onClick={() => {
            const menu = document.getElementById('context-menu')
            const nodeId = menu?.getAttribute('data-node-id')
            if (nodeId) handleSetStartScene(nodeId)
            if (menu) menu.style.display = 'none'
          }}
          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
        >
          <Play size={14} className="text-green-500" />
          Başlangıç sahnesi yap
        </button>
        <button
          onClick={() => {
            const menu = document.getElementById('context-menu')
            const nodeId = menu?.getAttribute('data-node-id')
            if (nodeId) router.push(`/panel`)
            if (menu) menu.style.display = 'none'
          }}
          className="w-full px-3 py-2 text-left text-sm text-white hover:bg-gray-700 flex items-center gap-2"
        >
          <Edit3 size={14} className="text-blue-500" />
          Sahneyi düzenle
        </button>
      </div>

      {/* Empty state */}
      {scenes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <GitBranch size={64} className="mx-auto text-gray-600 mb-4" />
            <h2 className="text-xl font-bold text-gray-400 mb-2">Henüz sahne yok</h2>
            <p className="text-gray-500">Önce hikayenize sahneler ekleyin</p>
          </div>
        </div>
      )}
    </div>
  )
}

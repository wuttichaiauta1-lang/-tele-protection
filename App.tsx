import React, { useState } from 'react';
import { generateChecklistFromAI } from './services/geminiService';
import { generateInspectionReport } from './services/pdfService';
import { Project, InspectionStatus, ChecklistSection, AIResponseSection } from './types';
import { Button } from './components/Button';

// Helper for ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'create' | 'inspect'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [inspectingProjectId, setInspectingProjectId] = useState<string | null>(null);
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [showRefImageModal, setShowRefImageModal] = useState<string | null>(null); // Image URL or null
  
  // Creation Form State
  const [newProjectData, setNewProjectData] = useState({
    name: '',
    contractor: '',
    siteName: '',
    equipmentType: '',
    context: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleCreateProject = async () => {
    if (!newProjectData.name || !newProjectData.equipmentType) {
        alert("กรุณากรอกชื่อโครงการและประเภทอุปกรณ์");
        return;
    }

    setIsGenerating(true);
    try {
      const aiResponse: AIResponseSection[] = await generateChecklistFromAI(
        newProjectData.equipmentType,
        newProjectData.context
      );

      const sections: ChecklistSection[] = aiResponse.map(section => ({
        id: generateId(),
        title: section.title,
        items: section.items.map(item => ({
          id: generateId(),
          description: item.description,
          standardCriteria: item.standard,
          status: InspectionStatus.PENDING,
          remark: ''
        }))
      }));

      const newProject: Project = {
        id: generateId(),
        name: newProjectData.name,
        contractor: newProjectData.contractor,
        equipmentType: newProjectData.equipmentType,
        siteName: newProjectData.siteName,
        dateCreated: new Date().toLocaleDateString('th-TH'),
        status: 'Draft',
        progress: 0,
        sections: sections
      };

      setProjects([newProject, ...projects]);
      setNewProjectData({ name: '', contractor: '', siteName: '', equipmentType: '', context: '' });
      setView('dashboard');
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการสร้าง Checklist: " + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- Project Modification Logic ---

  const updateItemStatus = (projectId: string, sectionId: string, itemId: string, status: InspectionStatus) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;

      const newSections = p.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map(i => i.id === itemId ? { ...i, status } : i)
        };
      });

      // Calculate progress
      const totalItems = newSections.reduce((acc, s) => acc + s.items.length, 0);
      const completedItems = newSections.reduce((acc, s) => 
        acc + s.items.filter(i => i.status !== InspectionStatus.PENDING).length, 0
      );
      const progress = totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);

      // Determine project status
      const projectStatus = progress === 100 ? 'Completed' : 'In Progress';

      return { ...p, sections: newSections, progress, status: projectStatus };
    }));
  };

  const updateItemDetails = (projectId: string, sectionId: string, itemId: string, field: 'description' | 'standardCriteria' | 'remark', value: string) => {
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return {
            ...p,
            sections: p.sections.map(s => {
                if (s.id !== sectionId) return s;
                return {
                    ...s,
                    items: s.items.map(i => i.id === itemId ? { ...i, [field]: value } : i)
                };
            })
        };
    }));
  };

  // Reference Image Upload Handler
  const handleRefImageUpload = (projectId: string, sectionId: string, itemId: string, file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
          const base64String = reader.result as string;
          setProjects(prev => prev.map(p => {
              if (p.id !== projectId) return p;
              return {
                  ...p,
                  sections: p.sections.map(s => {
                      if (s.id !== sectionId) return s;
                      return {
                          ...s,
                          items: s.items.map(i => i.id === itemId ? { ...i, referenceImage: base64String } : i)
                      };
                  })
              };
          }));
      };
      reader.readAsDataURL(file);
  };

  const handleAddItem = (projectId: string, sectionId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              sections: p.sections.map(s => {
                  if (s.id !== sectionId) return s;
                  return {
                      ...s,
                      items: [...s.items, {
                          id: generateId(),
                          description: 'รายการตรวจสอบใหม่',
                          standardCriteria: '',
                          status: InspectionStatus.PENDING,
                          remark: ''
                      }]
                  };
              })
          };
      }));
  };

  const handleDeleteItem = (projectId: string, sectionId: string, itemId: string) => {
      if(!confirm("ยืนยันการลบรายการนี้?")) return;
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              sections: p.sections.map(s => {
                  if (s.id !== sectionId) return s;
                  return {
                      ...s,
                      items: s.items.filter(i => i.id !== itemId)
                  };
              })
          };
      }));
  };

  const handleAddSection = (projectId: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              sections: [...p.sections, {
                  id: generateId(),
                  title: 'หมวดหมู่ใหม่',
                  items: []
              }]
          };
      }));
  };

  const handleDeleteSection = (projectId: string, sectionId: string) => {
    if(!confirm("ยืนยันการลบหมวดหมู่นี้และรายการทั้งหมดภายใน?")) return;
    setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return {
            ...p,
            sections: p.sections.filter(s => s.id !== sectionId)
        };
    }));
  };

  const handleInspect = (project: Project) => {
    setInspectingProjectId(project.id);
    setIsEditingMode(false);
    setView('inspect');
  };

  const handleExportPDF = async (project: Project) => {
      setIsExporting(true);
      try {
          await generateInspectionReport(project);
      } catch (error) {
          console.error(error);
          alert("ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่");
      } finally {
          setIsExporting(false);
      }
  };

  // --- Views ---

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายการโครงการตรวจสอบ</h1>
          <p className="text-gray-500 text-sm">จัดการการติดตั้ง Multiplexer และ Tele-protection</p>
        </div>
        <Button onClick={() => setView('create')}>
          + สร้างงานใหม่
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.length === 0 ? (
            <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200 border-dashed">
                <div className="text-gray-300 text-6xl mb-4">📋</div>
                <p className="text-gray-500 font-medium">ยังไม่มีโครงการ</p>
                <p className="text-gray-400 text-sm mt-1">เริ่มต้นด้วยการกดปุ่ม "สร้างงานใหม่" เพื่อให้ AI ช่วยสร้าง Checklist</p>
            </div>
        ) : projects.map(project => (
          <div key={project.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer group" onClick={() => handleInspect(project)}>
            <div className="flex justify-between items-start mb-4">
              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                project.status === 'Completed' ? 'bg-green-100 text-green-700' : 
                project.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
              }`}>
                {project.status === 'Completed' ? 'เสร็จสมบูรณ์' : project.status === 'In Progress' ? 'กำลังดำเนินการ' : 'ฉบับร่าง'}
              </span>
              <span className="text-gray-400 text-xs">{project.dateCreated}</span>
            </div>
            <h3 className="font-bold text-lg text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{project.name}</h3>
            <p className="text-sm text-gray-500 mb-1 flex items-center gap-1">📍 {project.siteName}</p>
            <p className="text-sm text-gray-500 mb-4 flex items-center gap-1">👷 {project.contractor}</p>
            
            <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-600">
                    <span>ความคืบหน้า</span>
                    <span>{project.progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                            project.progress === 100 ? 'bg-green-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${project.progress}%` }}
                    ></div>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCreateForm = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md border border-gray-200 p-8 animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span className="bg-blue-100 text-blue-600 p-2 rounded-lg">⚡</span> สร้างโครงการติดตั้งใหม่
      </h2>
      <div className="space-y-5">
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อโครงการ <span className="text-red-500">*</span></label>
            <input 
                type="text" 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="เช่น งานติดตั้ง SDH Node สถานีไทรน้อย"
                value={newProjectData.name}
                onChange={e => setNewProjectData({...newProjectData, name: e.target.value})}
            />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">บริษัทผู้รับเหมา</label>
                <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ระบุชื่อบริษัท"
                    value={newProjectData.contractor}
                    onChange={e => setNewProjectData({...newProjectData, contractor: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่ติดตั้ง (Site)</label>
                <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ระบุสถานี"
                    value={newProjectData.siteName}
                    onChange={e => setNewProjectData({...newProjectData, siteName: e.target.value})}
                />
            </div>
        </div>
        
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-3 text-sm">🤖 ตั้งค่า AI Generator</h3>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">ประเภทอุปกรณ์ <span className="text-red-500">*</span></label>
                    <input 
                        type="text" 
                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        placeholder="เช่น SDH Multiplexer, Tele-protection Unit, OPGW Splice Closure"
                        value={newProjectData.equipmentType}
                        onChange={e => setNewProjectData({...newProjectData, equipmentType: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">ข้อมูลบริบทเพิ่มเติม (Optional)</label>
                    <textarea 
                        className="w-full px-4 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        placeholder="เช่น เน้นเรื่องการเข้าหัว Fiber, การตรวจสอบระบบ Grounding ค่าต้องน้อยกว่า 5 โอห์ม, หรือมาตรฐานการเดินสาย DC"
                        rows={3}
                        value={newProjectData.context}
                        onChange={e => setNewProjectData({...newProjectData, context: e.target.value})}
                    />
                    <p className="text-xs text-blue-600 mt-1">ยิ่งระบุรายละเอียดมาก Checklist ที่ได้จะยิ่งตรงกับมาตรฐานงาน</p>
                </div>
            </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setView('dashboard')} className="flex-1">
                ยกเลิก
            </Button>
            <Button 
                variant="primary" 
                onClick={handleCreateProject} 
                className="flex-1"
                isLoading={isGenerating}
            >
                {isGenerating ? 'กำลังวิเคราะห์และสร้าง Checklist...' : 'สร้างโครงการ'}
            </Button>
        </div>
      </div>
    </div>
  );

  const renderInspectView = () => {
    const project = projects.find(p => p.id === inspectingProjectId);
    if (!project) return <div>Project not found</div>;

    const totalItems = project.sections.reduce((acc, s) => acc + s.items.length, 0);
    const passedItems = project.sections.reduce((acc, s) => 
        acc + s.items.filter(i => i.status === InspectionStatus.PASS).length, 0
    );

    return (
        <div className="animate-fade-in pb-20 relative">
             {/* Ref Image Modal */}
             {showRefImageModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowRefImageModal(null)}>
                    <div className="relative max-w-4xl max-h-[90vh]">
                        <img src={showRefImageModal} alt="Reference" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" />
                        <button className="absolute -top-4 -right-4 bg-white rounded-full p-2 hover:bg-gray-200" onClick={() => setShowRefImageModal(null)}>
                            ❌
                        </button>
                        <p className="text-center text-white mt-2">รูปตัวอย่างอ้างอิง (Reference Image)</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-white shadow-sm border-b sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView('dashboard')} className="text-gray-500 hover:text-gray-800">
                                ← กลับ
                            </button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 truncate max-w-[200px] sm:max-w-md">{project.name}</h1>
                                <div className="text-sm text-gray-500 flex flex-wrap gap-2">
                                    <span>📍 {project.siteName}</span>
                                    <span>👷 {project.contractor}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
                            <div className="hidden md:block text-right mr-2">
                                <div className="text-xl font-bold text-blue-600">{project.progress}%</div>
                                <div className="text-xs text-gray-400">ผ่าน {passedItems}/{totalItems}</div>
                            </div>
                            
                            {/* Edit Mode Toggle */}
                            <Button
                                variant={isEditingMode ? 'secondary' : 'ghost'}
                                className={`text-sm ${isEditingMode ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : ''}`}
                                onClick={() => setIsEditingMode(!isEditingMode)}
                            >
                                {isEditingMode ? '🔧 ปิดโหมดแก้ไข' : '🔧 แก้ไขรายการ'}
                            </Button>

                            <Button 
                                variant="secondary" 
                                className="flex-1 md:flex-none flex items-center gap-2 text-sm"
                                onClick={() => handleExportPDF(project)}
                                isLoading={isExporting}
                            >
                                📄 รายงาน
                            </Button>
                        </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full transition-all duration-300" style={{width: `${project.progress}%`}}></div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {isEditingMode && (
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4 text-sm text-yellow-800 flex items-center gap-2">
                        <span>ℹ️</span> คุณอยู่ในโหมดแก้ไข สามารถปรับปรุงข้อความ เพิ่ม/ลบ รายการ และอัปโหลดรูปตัวอย่าง (Reference) ได้
                    </div>
                )}

                {project.sections.map(section => (
                    <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center group">
                            <h3 className="font-bold text-gray-800 text-lg flex-1">
                                {isEditingMode ? (
                                    <input 
                                        type="text"
                                        className="bg-transparent border-b border-gray-400 w-full focus:outline-none focus:border-blue-500"
                                        defaultValue={section.title}
                                        onBlur={(e) => {
                                            // Implement Section Title Update logic here if needed
                                            // Simplified for now
                                        }}
                                    />
                                ) : section.title}
                            </h3>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                                    {section.items.filter(i => i.status !== InspectionStatus.PENDING).length} / {section.items.length}
                                </span>
                                {isEditingMode && (
                                    <button 
                                        onClick={() => handleDeleteSection(project.id, section.id)}
                                        className="text-red-400 hover:text-red-600 p-1"
                                        title="ลบหมวดหมู่"
                                    >
                                        🗑️
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {section.items.map(item => (
                                <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors relative group">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        {/* Left: Description & Standard */}
                                        <div className="flex-1 space-y-2">
                                            {/* Description Line */}
                                            <div className="flex items-start gap-2">
                                                <div className="mt-1 min-w-[20px] text-gray-400">🔹</div>
                                                <div className="w-full">
                                                    {isEditingMode ? (
                                                        <input 
                                                            type="text" 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm font-medium focus:ring-2 focus:ring-blue-200 outline-none"
                                                            value={item.description}
                                                            onChange={(e) => updateItemDetails(project.id, section.id, item.id, 'description', e.target.value)}
                                                        />
                                                    ) : (
                                                        <p className="text-gray-900 font-medium">{item.description}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Standard Line */}
                                            <div className="flex items-start gap-2 ml-7">
                                                <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap mt-0.5">
                                                    มาตรฐาน:
                                                </div>
                                                <div className="w-full">
                                                    {isEditingMode ? (
                                                        <textarea 
                                                            className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-gray-600 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                                                            rows={2}
                                                            placeholder="ระบุเกณฑ์มาตรฐาน (เช่น ค่าต้องไม่เกิน...)"
                                                            value={item.standardCriteria || ''}
                                                            onChange={(e) => updateItemDetails(project.id, section.id, item.id, 'standardCriteria', e.target.value)}
                                                        />
                                                    ) : (
                                                        <p className="text-sm text-gray-600">{item.standardCriteria || "-"}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Reference Image Logic */}
                                            <div className="ml-7 flex items-center gap-2 mt-1">
                                                {item.referenceImage ? (
                                                    <div className="flex items-center gap-2">
                                                        <img 
                                                            src={item.referenceImage} 
                                                            alt="Ref" 
                                                            className="w-10 h-10 object-cover rounded border cursor-zoom-in hover:opacity-80"
                                                            onClick={() => setShowRefImageModal(item.referenceImage!)}
                                                        />
                                                        {isEditingMode && (
                                                            <button 
                                                                className="text-xs text-red-500 hover:underline"
                                                                onClick={() => updateItemDetails(project.id, section.id, item.id, 'referenceImage' as any, '')}
                                                            >
                                                                ลบรูป
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    isEditingMode && (
                                                        <div className="flex items-center gap-2">
                                                            <label className="cursor-pointer text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-300 transition-colors flex items-center gap-1">
                                                                <span>🖼️</span> เพิ่มรูปตัวอย่าง
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    className="hidden"
                                                                    onChange={(e) => {
                                                                        if (e.target.files?.[0]) {
                                                                            handleRefImageUpload(project.id, section.id, item.id, e.target.files[0]);
                                                                        }
                                                                    }} 
                                                                />
                                                            </label>
                                                        </div>
                                                    )
                                                )}
                                                {(!isEditingMode && item.referenceImage) && (
                                                    <span className="text-xs text-gray-400">(คลิกที่รูปเพื่อดูตัวอย่าง)</span>
                                                )}
                                            </div>

                                            {/* Inspection Remark Input */}
                                            {!isEditingMode && (
                                                 <input 
                                                    type="text"
                                                    placeholder="บันทึกผลการตรวจสอบ/ข้อเสนอแนะ..."
                                                    className="ml-7 mt-2 text-sm w-[90%] bg-transparent border-b border-gray-200 focus:border-blue-400 outline-none py-1 text-gray-600 placeholder-gray-400"
                                                    value={item.remark || ''}
                                                    onChange={(e) => updateItemDetails(project.id, section.id, item.id, 'remark', e.target.value)}
                                                />
                                            )}
                                        </div>

                                        {/* Right: Actions */}
                                        <div className="flex flex-col gap-2 shrink-0 md:w-32">
                                            {isEditingMode ? (
                                                <button
                                                    onClick={() => handleDeleteItem(project.id, section.id, item.id)}
                                                    className="w-full py-1.5 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-all"
                                                >
                                                    ลบรายการ
                                                </button>
                                            ) : (
                                                <>
                                                    <div className="flex gap-1 justify-end">
                                                        <button
                                                            onClick={() => updateItemStatus(project.id, section.id, item.id, InspectionStatus.PASS)}
                                                            className={`flex-1 py-1.5 px-2 rounded-lg text-sm font-medium border transition-all ${
                                                                item.status === InspectionStatus.PASS 
                                                                ? 'bg-green-100 border-green-200 text-green-700 shadow-sm' 
                                                                : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                                            }`}
                                                            title="ผ่าน"
                                                        >
                                                            ✓
                                                        </button>
                                                        <button
                                                            onClick={() => updateItemStatus(project.id, section.id, item.id, InspectionStatus.FAIL)}
                                                            className={`flex-1 py-1.5 px-2 rounded-lg text-sm font-medium border transition-all ${
                                                                item.status === InspectionStatus.FAIL 
                                                                ? 'bg-red-100 border-red-200 text-red-700 shadow-sm' 
                                                                : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                                            }`}
                                                            title="ไม่ผ่าน"
                                                        >
                                                            ✕
                                                        </button>
                                                        <button
                                                            onClick={() => updateItemStatus(project.id, section.id, item.id, InspectionStatus.NA)}
                                                            className={`flex-1 py-1.5 px-2 rounded-lg text-sm font-medium border transition-all ${
                                                                item.status === InspectionStatus.NA
                                                                ? 'bg-gray-200 border-gray-300 text-gray-700 shadow-sm' 
                                                                : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                                            }`}
                                                            title="N/A"
                                                        >
                                                            -
                                                        </button>
                                                    </div>
                                                    <div className="text-center">
                                                        <StatusBadge status={item.status} />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    {(!isEditingMode && item.status === InspectionStatus.FAIL) && (
                                         <div className="ml-7 mt-2 text-xs text-red-500 flex items-center gap-1 animate-pulse">
                                            ⚠️ ต้องแก้ไข: {item.standardCriteria ? `อ้างอิง ${item.standardCriteria}` : 'โปรดระบุสาเหตุ'}
                                         </div>
                                    )}
                                </div>
                            ))}
                            {/* Add Item Button (Editing Mode) */}
                            {isEditingMode && (
                                <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                                    <button 
                                        onClick={() => handleAddItem(project.id, section.id)}
                                        className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1 w-full"
                                    >
                                        + เพิ่มรายการตรวจสอบ
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                 {/* Add Section Button (Editing Mode) */}
                 {isEditingMode && (
                    <button 
                        onClick={() => handleAddSection(project.id)}
                        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all font-medium"
                    >
                        + เพิ่มหมวดหมู่ใหม่
                    </button>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900">
        {view !== 'inspect' && (
            <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">T</div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">TeleGuard Inspect</span>
                    </div>
                    <div className="text-sm text-gray-500">
                        Engineer Control
                    </div>
                </div>
            </nav>
        )}

      <main className={view === 'inspect' ? '' : 'max-w-6xl mx-auto px-4 sm:px-6 py-8'}>
        {view === 'dashboard' && renderDashboard()}
        {view === 'create' && renderCreateForm()}
        {view === 'inspect' && renderInspectView()}
      </main>
    </div>
  );
};

// Simple internal component for status badge to avoid import loop issues if distinct file not preferred
const StatusBadge = ({ status }: { status: InspectionStatus }) => {
    switch (status) {
      case InspectionStatus.PASS:
        return <span className="text-xs font-semibold text-green-700">PASS</span>;
      case InspectionStatus.FAIL:
        return <span className="text-xs font-semibold text-red-700">FAIL</span>;
      case InspectionStatus.NA:
        return <span className="text-xs font-semibold text-gray-600">N/A</span>;
      default:
        return <span className="text-xs text-gray-400">Pending</span>;
    }
};

export default App;
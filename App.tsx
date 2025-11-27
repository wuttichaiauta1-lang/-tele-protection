import React, { useState } from 'react';
import { generateChecklistFromAI } from './services/geminiService';
import { generateInspectionReport } from './services/pdfService';
import { Project, InspectionStatus, ChecklistSection, AIResponseSection } from './types';
import { Button } from './components/Button';
import { StatusBadge } from './components/StatusBadge';

// Helper for ID generation
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [view, setView] = useState<'dashboard' | 'create' | 'inspect'>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
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

  // Reference Image Upload Handler (Standard/Example)
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

  // Actual Photo Upload Handler (Evidence)
  const handleActualPhotoUpload = (projectId: string, sectionId: string, itemId: string, file: File) => {
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
                          items: s.items.map(i => i.id === itemId ? { ...i, photo: base64String } : i)
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
                        <p className="text-center text-white mt-2">รูปขยาย (Full Preview)</p>
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
                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center gap-2 text-yellow-800 text-sm mb-4">
                        <span>ℹ️ คุณอยู่ในโหมดแก้ไข สามารถปรับปรุงข้อความ เพิ่ม/ลบ รายการ และอัปโหลดรูปมาตรฐาน (Ref) ได้</span>
                    </div>
                )}

                {project.sections.map(section => (
                    <div key={section.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            {isEditingMode ? (
                                <input 
                                    className="font-bold text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 outline-none w-full"
                                    value={section.title}
                                    onChange={(e) => {
                                        setProjects(prev => prev.map(p => p.id === project.id ? {
                                            ...p,
                                            sections: p.sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s)
                                        } : p));
                                    }}
                                />
                            ) : (
                                <h3 className="font-bold text-lg text-gray-800">{section.title}</h3>
                            )}
                            
                            {isEditingMode && (
                                <button onClick={() => handleDeleteSection(project.id, section.id)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                                    🗑️
                                </button>
                            )}
                        </div>
                        
                        <div className="divide-y divide-gray-100">
                            {section.items.map(item => (
                                <div key={item.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                        {/* Description & Standard (Cols 1-6) */}
                                        <div className="md:col-span-6 space-y-3">
                                            <div>
                                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">รายการตรวจสอบ</label>
                                                {isEditingMode ? (
                                                    <textarea 
                                                        className="w-full mt-1 p-2 border rounded-md text-sm"
                                                        value={item.description}
                                                        onChange={(e) => updateItemDetails(project.id, section.id, item.id, 'description', e.target.value)}
                                                        rows={2}
                                                    />
                                                ) : (
                                                    <p className="text-gray-900 font-medium mt-1">{item.description}</p>
                                                )}
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">เกณฑ์มาตรฐาน (Standard)</label>
                                                {isEditingMode ? (
                                                    <input 
                                                        className="w-full mt-1 p-2 border rounded-md text-sm text-blue-600"
                                                        value={item.standardCriteria || ''}
                                                        onChange={(e) => updateItemDetails(project.id, section.id, item.id, 'standardCriteria', e.target.value)}
                                                        placeholder="ระบุค่ามาตรฐาน..."
                                                    />
                                                ) : (
                                                    <p className="text-sm text-blue-600 mt-1">{item.standardCriteria || '-'}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Images Area (Cols 7-9) */}
                                        <div className="md:col-span-3 flex flex-col gap-2">
                                             {/* Reference Image */}
                                             <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">รูปมาตรฐาน (Ref)</div>
                                             {item.referenceImage ? (
                                                 <div className="relative group w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border">
                                                     <img 
                                                        src={item.referenceImage} 
                                                        className="w-full h-full object-cover cursor-pointer"
                                                        onClick={() => setShowRefImageModal(item.referenceImage!)}
                                                        alt="Ref"
                                                     />
                                                     {isEditingMode && (
                                                         <button 
                                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100"
                                                            onClick={() => updateItemDetails(project.id, section.id, item.id, 'referenceImage' as any, '')}
                                                         >x</button>
                                                     )}
                                                 </div>
                                             ) : (
                                                 isEditingMode && (
                                                    <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                                                        <span className="text-xs text-gray-400 text-center">อัปโหลด<br/>Ref</span>
                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleRefImageUpload(project.id, section.id, item.id, e.target.files[0])} />
                                                    </label>
                                                 )
                                             )}

                                             {/* Actual Photo */}
                                             {!isEditingMode && (
                                                <>
                                                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2">รูปหน้างาน (Site)</div>
                                                    {item.photo ? (
                                                        <div className="relative group w-24 h-24 bg-gray-100 rounded-lg overflow-hidden border">
                                                            <img 
                                                                src={item.photo} 
                                                                className="w-full h-full object-cover cursor-pointer"
                                                                onClick={() => setShowRefImageModal(item.photo!)}
                                                                alt="Site"
                                                            />
                                                            <button 
                                                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100"
                                                                onClick={() => updateItemDetails(project.id, section.id, item.id, 'photo' as any, '')}
                                                            >x</button>
                                                        </div>
                                                    ) : (
                                                        <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100">
                                                            <span className="text-2xl">📷</span>
                                                            <span className="text-xs text-blue-600">ถ่ายรูป</span>
                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handleActualPhotoUpload(project.id, section.id, item.id, e.target.files[0])} />
                                                        </label>
                                                    )}
                                                </>
                                             )}
                                        </div>

                                        {/* Action/Status Area (Cols 10-12) */}
                                        <div className="md:col-span-3 flex flex-col justify-between">
                                            {isEditingMode ? (
                                                <div className="flex justify-end">
                                                    <Button variant="danger" className="text-sm" onClick={() => handleDeleteItem(project.id, section.id, item.id)}>
                                                        ลบรายการ
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="flex flex-col gap-2">
                                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">สถานะ</label>
                                                        <div className="flex gap-2">
                                                            <button 
                                                                onClick={() => updateItemStatus(project.id, section.id, item.id, InspectionStatus.PASS)}
                                                                className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-all ${item.status === InspectionStatus.PASS ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-green-50'}`}
                                                            >
                                                                ผ่าน
                                                            </button>
                                                            <button 
                                                                onClick={() => updateItemStatus(project.id, section.id, item.id, InspectionStatus.FAIL)}
                                                                className={`flex-1 py-1.5 rounded-md text-sm font-medium border transition-all ${item.status === InspectionStatus.FAIL ? 'bg-red-600 text-white border-red-600 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-red-50'}`}
                                                            >
                                                                ไม่ผ่าน
                                                            </button>
                                                            <button 
                                                                onClick={() => updateItemStatus(project.id, section.id, item.id, InspectionStatus.NA)}
                                                                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-all ${item.status === InspectionStatus.NA ? 'bg-gray-600 text-white border-gray-600 shadow-sm' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                                            >
                                                                N/A
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">หมายเหตุ / Defect Detail</label>
                                                        <textarea 
                                                            className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-md text-sm focus:bg-white focus:border-blue-500 outline-none transition-all"
                                                            placeholder="ระบุสาเหตุที่ไม่ผ่าน..."
                                                            rows={2}
                                                            value={item.remark}
                                                            onBlur={() => {}} // Fix for Vercel: Changed empty function to valid format
                                                            onChange={(e) => updateItemDetails(project.id, section.id, item.id, 'remark', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Status Badge Indicator (Visible only when not pending) */}
                                    {!isEditingMode && item.status !== InspectionStatus.PENDING && (
                                        <div className="mt-4 flex justify-end">
                                            <StatusBadge status={item.status} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {isEditingMode && (
                            <div className="bg-gray-50 p-4 border-t border-gray-200 text-center">
                                <Button variant="secondary" onClick={() => handleAddItem(project.id, section.id)} className="w-full sm:w-auto mx-auto">
                                    + เพิ่มรายการตรวจสอบ
                                </Button>
                            </div>
                        )}
                    </div>
                ))}

                {isEditingMode && (
                     <Button variant="secondary" className="w-full py-4 border-dashed border-2" onClick={() => handleAddSection(project.id)}>
                        + เพิ่มหมวดหมู่ใหม่
                    </Button>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sarabun">
        {/* Navbar */}
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex items-center cursor-pointer" onClick={() => setView('dashboard')}>
                        <span className="text-blue-600 text-2xl mr-2">📡</span>
                        <span className="font-bold text-xl text-gray-900">TeleGuard Inspect</span>
                    </div>
                    <div className="flex items-center">
                        <span className="text-xs text-gray-400 hidden sm:block">เวอร์ชัน 1.2 (Vercel Ready)</span>
                    </div>
                </div>
            </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {view === 'dashboard' && renderDashboard()}
            {view === 'create' && renderCreateForm()}
            {view === 'inspect' && renderInspectView()}
        </main>
    </div>
  );
};

export default App;
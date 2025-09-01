'use client'

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, BarChart2, FilePlus2, Download, Upload, Trash2, Eye, Edit3, Check, FileUp, FileText, Copy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";

/********************
 *  UTILIDADES
 *******************/
const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const fmtMoney = (n) => CLP.format(Math.round(n || 0));
const uid = () => Math.random().toString(36).slice(2, 9);
const todayISO = () => new Date().toISOString().slice(0,10);
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => { 
    const MAX_MB = 20;
    if (file.size > MAX_MB * 1024 * 1024) {
      reject(new Error(`El archivo supera ${MAX_MB}MB`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, size: file.size, type: file.type, dataUrl: String(reader.result), id: uid(), addedAt: new Date().toISOString() });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/********************
 *  PERSISTENCIA
 *******************/
const STORAGE_KEY = "meg-industrial-sw";
function useStore() {
  const [data, setData] = useState(() => {
    try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
    return { cotizaciones: [] };
  });
  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  return { data, setData };
}

/********************
 *  APP PRINCIPAL — LIGHT THEME
 *******************/
export default function App() {
  const { data, setData } = useStore();
  const [tab, setTab] = useState("dashboard");
  const [usarNetoSinIVA, setUsarNetoSinIVA] = useState(true);

  // KPIs globales desde cotizaciones (factura y OT)
  const totales = useMemo(()=>{
    let ingresos = 0, costos = 0;
    for (const c of data.cotizaciones) {
      const fact = Number(c?.factura?.total || 0);
      const factCalc = usarNetoSinIVA ? (fact/1.19) : fact;
      const otTotal = (c?.ot?.items || []).reduce((s,i)=> s + (Number(i.cantidad||0) * Number(i.costo||0)), 0);
      ingresos += factCalc;
      costos   += otTotal;
    }
    return { ingresos, costos, utilidad: Math.max(ingresos - costos, 0) };
  }, [data.cotizaciones, usarNetoSinIVA]);

  // Series mensualizadas
  const monthly = useMemo(()=>{
    const map = {};
    for (const c of data.cotizaciones) {
      const fFecha = c?.factura?.fecha || c?.fecha || todayISO();
      const oFecha = c?.ot?.fecha || c?.fecha || todayISO();
      const mF = fFecha.slice(0,7);
      const mO = oFecha.slice(0,7);
      const fact = Number(c?.factura?.total || 0);
      const factCalc = usarNetoSinIVA ? (fact/1.19) : fact;
      const otTotal = (c?.ot?.items || []).reduce((s,i)=> s + (Number(i.cantidad||0) * Number(i.costo||0)), 0);
      map[mF] ??= { mes:mF, ingresos:0, costos:0 };
      map[mF].ingresos += factCalc;
      map[mO] ??= { mes:mO, ingresos:0, costos:0 };
      map[mO].costos   += otTotal;
    }
    return Object.values(map).sort((a,b)=> a.mes.localeCompare(b.mes));
  }, [data.cotizaciones, usarNetoSinIVA]);

  // Utilidad por cliente
  const utilPorCliente = useMemo(()=>{
    const byCli = {};
    for (const c of data.cotizaciones) {
      const cli = c.cliente || "Sin cliente";
      const fact = Number(c?.factura?.total || 0);
      const factCalc = usarNetoSinIVA ? (fact/1.19) : fact;
      const otTotal = (c?.ot?.items || []).reduce((s,i)=> s + (Number(i.cantidad||0) * Number(i.costo||0)), 0);
      byCli[cli] ??= { ingresos:0, costos:0 };
      byCli[cli].ingresos += factCalc;
      byCli[cli].costos   += otTotal;
    }
    return Object.entries(byCli)
      .map(([name, v]) => ({ name, value: Math.max(v.ingresos - v.costos, 0) }))
      .filter(x=>x.value>0);
  }, [data.cotizaciones, usarNetoSinIVA]);

  // Exportar / Importar
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `meg-industrial-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { const parsed = JSON.parse(String(reader.result)); setData(parsed); } catch(e){ alert("Archivo inválido"); }
    };
    reader.readAsText(file);
  };

  // Duplicar cotización
  const duplicarCotizacion = (c) => {
    const copia = deepClone(c);
    copia.id = uid();
    copia.numero = c.numero + "-COPY";
    copia.fecha = todayISO();
    setData(d => ({ ...d, cotizaciones: [copia, ...d.cotizaciones] }));
    alert("Cotización duplicada");
  };

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/80 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">MEG Industrial SW</h1>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportJSON} className="gap-2"><Download size={18}/> Exportar</Button>
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300">
              <Upload size={18}/> Importar
              <input type="file" accept="application/json" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if (f) importJSON(f); }}/>
            </label>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-3 w-full md:w-auto bg-white border border-neutral-200">
            <TabsTrigger value="dashboard" className="gap-2"><BarChart2 size={18}/> Dashboard</TabsTrigger>
            <TabsTrigger value="cotizaciones" className="gap-2"><Eye size={18}/> Cotizaciones</TabsTrigger>
            <TabsTrigger value="nueva" className="gap-2"><FilePlus2 size={18}/> Nueva Cotización</TabsTrigger>
          </TabsList>

          {/* DASHBOARD */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="flex items-center gap-3 text-sm">
              <input id="neto" type="checkbox" checked={usarNetoSinIVA} onChange={(e)=>setUsarNetoSinIVA(e.target.checked)} />
              <label htmlFor="neto" className="text-neutral-700">Calcular Ingresos sin IVA (recomendado para utilidad)</label>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <KPICard title="Ingresos" value={fmtMoney(totales.ingresos)} subtitle={`${totFactCount(data)} factura(s) ${usarNetoSinIVA?"· neto":"· bruto"}`} />
              <KPICard title="Costos (OT)" value={fmtMoney(totales.costos)} subtitle={`${totOTCount(data)} cot(s) con OT`} />
              <KPICard title="Utilidad" value={fmtMoney(totales.utilidad)} highlight />
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2 bg-white border border-neutral-200">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Ingresos vs Costos por mes</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="mes" />
                        <YAxis tickFormatter={(v)=>CLP.format(v)} />
                        <Tooltip formatter={(v)=>fmtMoney(v)} />
                        <Legend />
                        <Bar dataKey="ingresos" name="Ingresos" />
                        <Bar dataKey="costos" name="Costos" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border border-neutral-200">
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Utilidad por cliente</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={utilPorCliente} dataKey="value" nameKey="name" outerRadius={100} label={({name, value})=>`${name} ${fmtMoney(value)}`}>
                          {utilPorCliente.map((_, i) => (<Cell key={i} />))}
                        </Pie>
                        <Tooltip formatter={(v)=>fmtMoney(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* COTIZACIONES */}
          <TabsContent value="cotizaciones" className="mt-6 space-y-4">
            <Card className="bg-white border border-neutral-200">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold">Filtros</h3>
                <FiltrosCotizaciones />
              </CardContent>
            </Card>

            <ListadoCotizaciones
              cotizaciones={data.cotizaciones}
              usarNetoSinIVA={usarNetoSinIVA}
              onSaveCotizacion={(updated)=> setData(d=>({
                ...d,
                cotizaciones: d.cotizaciones.map(x=> x.id===updated.id? updated : x)
              }))}
              onDuplicar={duplicarCotizacion}
              onDeleteCotizacion={(id)=> setData(d=>({
                ...d,
                cotizaciones: d.cotizaciones.filter(x=> x.id !== id)
              }))}
            />
          </TabsContent>

          {/* NUEVA COTIZACIÓN */}
          <TabsContent value="nueva" className="mt-6">
            <Card className="bg-white border border-neutral-200">
              <CardContent className="p-6 space-y-6">
                <h3 className="text-xl font-semibold">Crear Cotización</h3>
                <CotizacionForm onSave={(c)=> setData(d=>({...d, cotizaciones:[c, ...d.cotizaciones]}))} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

const totFactCount = (data) => data.cotizaciones.filter(c=>Number(c?.factura?.total||0)>0).length;
const totOTCount   = (data) => data.cotizaciones.filter(c=>(c?.ot?.items||[]).length>0).length;

/********************
 *  SUBCOMPONENTES COMUNES
 *******************/
function KPICard({ title, value, subtitle, highlight }){
  return (
    <Card className={`border ${highlight?"bg-emerald-50 border-emerald-200":"bg-white border-neutral-200"}`}>
      <CardContent className="p-4">
        <div className="text-sm text-neutral-600">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <div className="text-xs text-neutral-600 mt-1">{subtitle}</div>}
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }){
  return (
    <div className={className}>
      <Label className="text-neutral-700">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function SumBox({ title, value, highlight }){
  return (
    <div className={`p-4 rounded-2xl border ${highlight?"bg-emerald-50 border-emerald-200":"bg-white border-neutral-200"}`}>
      <div className="text-sm text-neutral-600">{title}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}

function badgeVariant(estado) {
  switch(estado){
    case "Aprobada": return "default";
    case "Enviada": return "secondary";
    case "Rechazada": return "destructive";
    default: return "outline";
  }
}

/********************
 *  ADMIN DE PDFs (con visor embebido)
 *******************/
function PDFManager({ label, files = [], onChange }){
  const addInputRef = React.useRef(null);
  const replaceRefs = React.useRef({});
  const [preview, setPreview] = useState(null);

  const addFiles = async (fileList) => {
    try{
      const arr = Array.from(fileList || []);
      if (arr.length === 0) return;
      const loaded = await Promise.all(arr.map(readFileAsDataURL));
      onChange([...(files||[]), ...loaded]);
    }catch(e){
      alert(e.message || "No se pudo cargar el archivo");
    }
  };

  const onClickAdd = () => addInputRef.current?.click();
  const onReplace = (id) => replaceRefs.current[id]?.click();

  const handleReplace = async (id, file) => {
    if (!file) return;
    try{
      const loaded = await readFileAsDataURL(file);
      onChange((files||[]).map(f=> f.id===id ? loaded : f));
    }catch(e){
      alert(e.message || "No se pudo reemplazar el archivo");
    }
  };

  const removeFile = (id) => onChange((files||[]).filter(f=>f.id!==id));

  const onDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-700">{label}</div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="gap-2" onClick={onClickAdd}><FileUp size={16}/> Agregar PDF</Button>
          <input ref={addInputRef} type="file" accept="application/pdf" multiple className="hidden"
                 onChange={e=>{ if (e.target.files) addFiles(e.target.files); e.target.value=""; }} />
        </div>
      </div>

      <div
        className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3 text-center text-neutral-500"
        onDragOver={(e)=>e.preventDefault()}
        onDrop={onDrop}
      >
        Arrastra y suelta PDF(s) aquí, o usa “Agregar PDF”.
      </div>

      <Card className="bg-white border border-neutral-200">
        <CardContent className="p-0">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="w-32">Tamaño</TableHead>
                <TableHead className="w-40">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(files||[]).length===0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-neutral-500 py-4">Sin PDFs</TableCell></TableRow>
              )}
              {(files||[]).map(f=>(
                <TableRow key={f.id} className="hover:bg-neutral-50">
                  <TableCell><FileText size={16}/></TableCell>
                  <TableCell className="truncate">{f.name || "Documento.pdf"}</TableCell>
                  <TableCell>{Math.round((f.size||0)/1024)} KB</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={()=>setPreview({ name:f.name, dataUrl:f.dataUrl })}>Ver</Button>
                      <Button size="sm" variant="secondary" onClick={()=>onReplace(f.id)}>Reemplazar</Button>
                      <input
                        ref={el=>{ if (el) replaceRefs.current[f.id] = el; }}
                        type="file" accept="application/pdf" className="hidden"
                        onChange={e=>{ const file = e.target.files?.[0]; handleReplace(f.id, file); e.target.value=""; }}
                      />
                      <Button size="sm" variant="ghost" onClick={()=>removeFile(f.id)}><Trash2 size={16}/></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o)=>{ if(!o) setPreview(null); }}>
        <DialogContent className="max-w-5xl h-[80vh] overflow-hidden">
          <DialogHeader><DialogTitle>{preview?.name || "Vista de PDF"}</DialogTitle></DialogHeader>
          {preview && (
            <iframe
              title="pdf"
              src={preview.dataUrl}
              className="w-full h-full rounded-lg border"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/********************
 *  FORMULARIO — COTIZACIÓN (NUEVA)
 *******************/
function CotizacionForm({ onSave }){
  // Datos clave
  const [numero, setNumero]   = useState( "CTZ-" + new Date().toISOString().slice(2,10).replaceAll("-","") + "-" + (1+Math.floor(Math.random()*99)).toString().padStart(2,"0") );
  const [fecha, setFecha]     = useState(todayISO());
  const [cliente, setCliente] = useState("");
  const [solicitud, setSolicitud] = useState("");
  const [estado, setEstado] = useState("Borrador");
  const [montoCot, setMontoCot] = useState(0);
  const [cotPDFs, setCotPDFs] = useState([]);

  // OC
  const [ocCodigo, setOCCodigo] = useState("");
  const [ocMonto, setOCMonto] = useState(0);
  const [ocPDFs, setOCPDFs] = useState([]);

  // OT
  const [otFecha, setOTFecha] = useState(todayISO());
  const [otItems, setOTItems] = useState([{ id:uid(), descripcion:"Servicio", cantidad:1, costo:0 }]);
  const [otPDFs, setOTPDFs] = useState([]);

  // Factura
  const [factFecha, setFactFecha] = useState(todayISO());
  const [factTotal, setFactTotal] = useState(0); // con IVA
  const [factPDFs, setFactPDFs] = useState([]);

  // OT helpers
  const addOTItem = () => setOTItems(prev => [...prev, { id:uid(), descripcion:"", cantidad:1, costo:0 }]);
  const rmOTItem  = (id) => setOTItems(prev => prev.filter(i=>i.id!==id));
  const upOTItem  = (id, patch) => setOTItems(prev => prev.map(i=> i.id===id ? { ...i, ...patch } : i));

  const otTotal = otItems.reduce((s,i)=> s + Number(i.cantidad||0)*Number(i.costo||0), 0);
  const utilidad = Math.max(Number(factTotal||0) - otTotal, 0);

  const save = () => {
    if (!cliente) { alert("Ingresa el cliente"); return; }
    const c = {
      id: uid(),
      numero, fecha, cliente, solicitud, estado,
      monto: Number(montoCot||0), pdfs: cotPDFs,
      oc: { codigo: ocCodigo, monto: Number(ocMonto||0), pdfs: ocPDFs },
      ot: { fecha: otFecha, items: otItems, pdfs: otPDFs },
      factura: { fecha: factFecha, total: Number(factTotal||0), pdfs: factPDFs }
    };
    onSave(c);
    alert("Cotización guardada");
  };

  return (
    <div className="space-y-8">
      {/* Datos clave */}
      <section className="grid md:grid-cols-3 gap-4">
        <Field label="N° Cotización"><Input value={numero} onChange={e=>setNumero(e.target.value)} /></Field>
        <Field label="Fecha"><Input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} /></Field>
        <Field label="Estado">
          <select className="w-full bg-white border rounded-md h-10 px-3" value={estado} onChange={e=>setEstado(e.target.value)}>
            <option>Borrador</option><option>Enviada</option><option>Aprobada</option><option>Rechazada</option>
          </select>
        </Field>
        <Field label="Cliente"><Input value={cliente} onChange={e=>setCliente(e.target.value)} /></Field>
        <Field label="Solicitud / Proyecto" className="md:col-span-2"><Input value={solicitud} onChange={e=>setSolicitud(e.target.value)} /></Field>
        <Field label="Monto Cotización (registro)"><Input type="number" value={montoCot} onChange={e=>setMontoCot(Number(e.target.value))} /></Field>
      </section>

      <PDFManager label="PDF(s) de la Cotización" files={cotPDFs} onChange={setCotPDFs} />

      {/* OC */}
      <section className="grid md:grid-cols-3 gap-4">
        <Field label="OC del Cliente (código)"><Input value={ocCodigo} onChange={e=>setOCCodigo(e.target.value)} placeholder="OC-1234 / referencia" /></Field>
        <Field label="Monto OC (registro)"><Input type="number" value={ocMonto} onChange={e=>setOCMonto(Number(e.target.value))} /></Field>
      </section>

      <PDFManager label="PDF(s) de la OC del Cliente" files={ocPDFs} onChange={setOCPDFs} />

      {/* OT */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">Orden de Trabajo (OT)</h4>
          <div className="flex items-center gap-3">
            <Field label="Fecha OT">
              <Input type="date" value={otFecha} onChange={e=>setOTFecha(e.target.value)} />
            </Field>
            <Button variant="secondary" className="gap-2" onClick={addOTItem}><Plus size={16}/> Agregar Servicio</Button>
          </div>
        </div>
        <Card className="bg-white border border-neutral-200">
          <CardContent className="p-0">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-24 text-right">Cantidad</TableHead>
                  <TableHead className="w-36 text-right">Costo Unit.</TableHead>
                  <TableHead className="w-36 text-right">Subtotal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otItems.map(it => (
                  <TableRow key={it.id} className="hover:bg-neutral-50">
                    <TableCell><Input value={it.descripcion} onChange={e=>upOTItem(it.id, { descripcion:e.target.value })} /></TableCell>
                    <TableCell className="text-right"><Input type="number" value={it.cantidad} onChange={e=>upOTItem(it.id, { cantidad:Number(e.target.value) })} /></TableCell>
                    <TableCell className="text-right"><Input type="number" value={it.costo} onChange={e=>upOTItem(it.id, { costo:Number(e.target.value) })} /></TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(Number(it.cantidad||0)*Number(it.costo||0))}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={()=>rmOTItem(it.id)}><Trash2 size={16}/></Button></TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">Total OT</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(otTotal)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <PDFManager label="PDF(s) de la OT" files={otPDFs} onChange={setOTPDFs} />

      {/* Factura */}
      <section className="space-y-3">
        <h4 className="text-lg font-semibold">Factura de Venta</h4>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Fecha Factura"><Input type="date" value={factFecha} onChange={e=>setFactFecha(e.target.value)} /></Field>
          <Field label="Total (con IVA)"><Input type="number" value={factTotal} onChange={e=>setFactTotal(Number(e.target.value))} /></Field>
          <SumBox title="Utilidad (Factura − OT)" value={fmtMoney(utilidad)} highlight />
        </div>
      </section>

      <PDFManager label="PDF(s) de la Factura" files={factPDFs} onChange={setFactPDFs} />

      <div className="flex gap-2">
        <Button className="gap-2" onClick={save}><Save size={18}/> Guardar Cotización</Button>
      </div>
    </div>
  );
}

/********************
 *  LISTADO + FILTROS + DETALLE/EDICIÓN + PAGINACIÓN
 *******************/
function FiltrosCotizaciones(){
  const [numero, setNumero] = useState("");
  const [cliente, setCliente] = useState("");
  const [solicitud, setSolicitud] = useState("");
  const [estado, setEstado] = useState("");

  useEffect(()=>{
    sessionStorage.setItem("filtro-numero", numero);
    sessionStorage.setItem("filtro-cliente", cliente);
    sessionStorage.setItem("filtro-solicitud", solicitud);
    sessionStorage.setItem("filtro-estado", estado);
  }, [numero, cliente, solicitud, estado]);

  useEffect(()=>{
    setNumero(sessionStorage.getItem("filtro-numero")||"");
    setCliente(sessionStorage.getItem("filtro-cliente")||"");
    setSolicitud(sessionStorage.getItem("filtro-solicitud")||"");
    setEstado(sessionStorage.getItem("filtro-estado")||"");
  }, []);

  if (typeof window !== "undefined") {
    window.__filtros__ = { numero, cliente, solicitud, estado };
  }

  return (
    <div className="grid md:grid-cols-4 gap-3">
      <Field label="Código / N°"><Input value={numero} onChange={e=>setNumero(e.target.value)} placeholder="CTZ-..."/></Field>
      <Field label="Empresa / Cliente"><Input value={cliente} onChange={e=>setCliente(e.target.value)} placeholder="Santa Marta, INOXA..."/></Field>
      <Field label="Solicitud / Proyecto"><Input value={solicitud} onChange={e=>setSolicitud(e.target.value)} placeholder="Longovilo, Contenedor 40&quot;..."/></Field>
      <Field label="Estado">
        <select className="w-full bg-white border rounded-md h-10 px-3" value={estado} onChange={e=>setEstado(e.target.value)}>
          <option value="">Todos</option>
          <option value="Borrador">Borrador</option>
          <option value="Enviada">Enviada</option>
          <option value="Aprobada">Aprobada</option>
          <option value="Rechazada">Rechazada</option>
        </select>
      </Field>
    </div>
  );
}

function ListadoCotizaciones({ cotizaciones, usarNetoSinIVA, onSaveCotizacion, onDuplicar, onDeleteCotizacion }){
  const filtros = (typeof window !== "undefined" && window.__filtros__) || { numero:"", cliente:"", solicitud:"", estado:"" };
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const rowsAll = cotizaciones
    .filter(c =>
      (filtros.numero? c.numero.toLowerCase().includes(filtros.numero.toLowerCase()) : true) &&
      (filtros.cliente? c.cliente.toLowerCase().includes(filtros.cliente.toLowerCase()) : true) &&
      (filtros.solicitud? (c.solicitud||"").toLowerCase().includes(filtros.solicitud.toLowerCase()) : true) &&
      (filtros.estado? c.estado===filtros.estado : true)
    )
    .sort((a,b)=> (b.fecha||"").localeCompare(a.fecha||""));

  const totalPages = Math.max(1, Math.ceil(rowsAll.length / pageSize));
  const current = rowsAll.slice((page-1)*pageSize, page*pageSize);

  const makeRow = (c) => {
    const fact = Number(c?.factura?.total || 0);
    const factCalc = usarNetoSinIVA ? (fact/1.19) : fact;
    const otTotal = (c?.ot?.items || []).reduce((s,i)=> s + (Number(i.cantidad||0) * Number(i.costo||0)), 0);
    const utilidad = Math.max(factCalc - otTotal, 0);
    const ocRef = (c?.oc?.codigo ?? c?.oc ?? "—");
    return { c, factCalc, otTotal, utilidad, ocRef };
  };

  return (
    <Card className="bg-white border border-neutral-200">
      <CardContent className="p-4 space-y-3">
        <Table className="text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>N°</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Solicitud</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>OC</TableHead>
              <TableHead className="text-right">Monto Cot.</TableHead>
              <TableHead className="text-right">Factura {usarNetoSinIVA ? "(neto)" : "(bruto)"}</TableHead>
              <TableHead className="text-right">Total OT</TableHead>
              <TableHead className="text-right">Utilidad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.length===0 && (<TableRow><TableCell colSpan={11} className="text-center text-neutral-500 py-6">Sin resultados</TableCell></TableRow>)}
            {current.map(c => {
              const r = makeRow(c);
              return (
                <TableRow key={c.id} className="hover:bg-neutral-50">
                  <TableCell>{c.numero}</TableCell>
                  <TableCell>{c.fecha}</TableCell>
                  <TableCell>{c.cliente}</TableCell>
                  <TableCell>{c.solicitud || "—"}</TableCell>
                  <TableCell><Badge variant={badgeVariant(c.estado)}>{c.estado||"Borrador"}</Badge></TableCell>
                  <TableCell>{r.ocRef}</TableCell>
                  <TableCell className="text-right">{fmtMoney(Number(c?.monto||0))}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.factCalc)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.otTotal)}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(r.utilidad)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="secondary" className="gap-1" onClick={()=>onDuplicar(c)}><Copy size={14}/> Duplicar</Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="secondary" className="gap-1"><Eye size={14}/> Ver / Editar</Button>
                        </DialogTrigger>
                        {/* Scroll habilitado dentro del modal */}
                        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader><DialogTitle>{c.numero} — {c.cliente}</DialogTitle></DialogHeader>
                          <DetalleCotizacionEditable
                            initial={c}
                            usarNetoSinIVA={usarNetoSinIVA}
                            onSave={onSaveCotizacion}
                            onDelete={()=>onDeleteCotizacion(c.id)}
                          />
                        </DialogContent>
                      </Dialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Paginador page={page} totalPages={totalPages} onPageChange={setPage} totalRows={rowsAll.length} pageSize={pageSize} />
      </CardContent>
    </Card>
  );
}

function Paginador({ page, totalPages, onPageChange, totalRows, pageSize }){
  const start = (page-1)*pageSize + 1;
  const end = Math.min(totalRows, page*pageSize);
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="text-neutral-600">Mostrando {start}-{end} de {totalRows}</div>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page<=1} onClick={()=>onPageChange(page-1)}>Anterior</Button>
        <div className="px-3 py-2 rounded-md border bg-white">{page} / {totalPages}</div>
        <Button variant="secondary" disabled={page>=totalPages} onClick={()=>onPageChange(page+1)}>Siguiente</Button>
      </div>
    </div>
  );
}

/********************
 *  DETALLE / EDICIÓN COMPLETA
 *******************/
function DetalleCotizacionEditable({ initial, usarNetoSinIVA, onSave, onDelete }){
  const [edit, setEdit] = useState(false);
  const [cot, setCot] = useState(deepClone(initial));

  useEffect(()=>{ setCot(deepClone(initial)); setEdit(false); }, [initial?.id]);

  const setField = (k, v) => setCot(prev => ({ ...prev, [k]: v }));
  const setFactura = (patch) => setCot(prev => ({ ...prev, factura: { ...(prev.factura||{}), ...patch } }));
  const setOT = (patch) => setCot(prev => ({ ...prev, ot: { ...(prev.ot||{items:[]}), ...patch } }));
  const setOTItems = (items) => setOT({ ...(cot.ot||{}), items });
  const setOCO = (patch) => setCot(prev => ({ ...prev, oc: { ...(prev.oc||{}), ...patch } }));
  const setCotPDFs = (files) => setField("pdfs", typeof files === "function" ? files(cot.pdfs||[]) : files);

  const addItem = () => setOTItems([...(cot.ot?.items||[]), { id:uid(), descripcion:"", cantidad:1, costo:0 }]);
  const rmItem  = (id) => setOTItems((cot.ot?.items||[]).filter(i=>i.id!==id));
  const upItem  = (id, patch) => setOTItems((cot.ot?.items||[]).map(i=> i.id===id? { ...i, ...patch } : i));

  const otTotal = (cot.ot?.items||[]).reduce((s,i)=> s + Number(i.cantidad||0)*Number(i.costo||0), 0);
  const fact     = Number(cot?.factura?.total || 0);
  const factCalc = usarNetoSinIVA ? (fact/1.19) : fact;
  const utilidad = Math.max(factCalc - otTotal, 0);

  const saveAll = () => {
    onSave({ ...cot, id: initial.id });
    setEdit(false);
    alert("Cambios guardados");
  };

  const tryDelete = () => {
    if (confirm(`¿Eliminar la cotización ${initial.numero}? Esta acción no se puede deshacer.`)) {
      onDelete?.();
    }
  };

  // asegurar estructuras
  const oc = cot.oc || { codigo:"", monto:0, pdfs:[] };
  const cotPDFs = cot.pdfs || [];
  const otPDFs = (cot.ot?.pdfs) || [];
  const factPDFs = (cot.factura?.pdfs) || [];

  return (
    <div className="space-y-6 text-sm">
      {/* Barra de acciones */}
      <div className="flex items-center justify-between">
        <div className="text-neutral-600">ID: {initial.id}</div>
        <div className="flex gap-2">
          {edit ? (
            <>
              <Button onClick={saveAll} className="gap-2"><Check size={16}/> Guardar cambios</Button>
              <Button variant="secondary" onClick={()=>{ setCot(deepClone(initial)); setEdit(false); }}>Cancelar</Button>
            </>
          ) : (
            <Button variant="secondary" onClick={()=>setEdit(true)} className="gap-2"><Edit3 size={16}/> Editar</Button>
          )}
          <Button variant="destructive" onClick={tryDelete} className="gap-2"><Trash2 size={16}/> Eliminar</Button>
        </div>
      </div>

      {/* Datos clave + Totales (TODO editable: numero y fecha incluidos) */}
      <div className="grid md:grid-cols-3 gap-4">
        <Field label="N° Cotización">
          {edit ? <Input value={cot.numero||""} onChange={e=>setField("numero", e.target.value)} /> : <div>{cot.numero}</div>}
        </Field>
        <Field label="Fecha">
          {edit ? <Input type="date" value={cot.fecha||todayISO()} onChange={e=>setField("fecha", e.target.value)} /> : <div>{cot.fecha}</div>}
        </Field>
        <Field label="Estado">
          {edit ? (
            <select className="w-full bg-white border rounded-md h-10 px-3" value={cot.estado||"Borrador"} onChange={e=>setField("estado", e.target.value)}>
              <option>Borrador</option><option>Enviada</option><option>Aprobada</option><option>Rechazada</option>
            </select>
          ) : <Badge variant={badgeVariant(cot.estado)}>{cot.estado||"Borrador"}</Badge>}
        </Field>

        <Field label="Cliente">
          {edit ? <Input value={cot.cliente||""} onChange={e=>setField("cliente", e.target.value)} /> : <div>{cot.cliente}</div>}
        </Field>
        <Field label="Solicitud / Proyecto" className="md:col-span-2">
          {edit ? <Input value={cot.solicitud||""} onChange={e=>setField("solicitud", e.target.value)} /> : <div>{cot.solicitud || "—"}</div>}
        </Field>

        <Field label="Monto Cotización (registro)" className="md:col-span-3">
          {edit ? <Input type="number" value={Number(cot.monto||0)} onChange={e=>setField("monto", Number(e.target.value))} /> : <div>{fmtMoney(Number(cot.monto||0))}</div>}
        </Field>

        <div className="grid grid-cols-3 gap-2 md:col-span-3">
          <SumBox title={`Factura ${usarNetoSinIVA?"(neto)":""}`} value={fmtMoney(factCalc)} />
          <SumBox title="Total OT" value={fmtMoney(otTotal)} />
          <SumBox title="Utilidad" value={fmtMoney(utilidad)} highlight />
        </div>
      </div>

      <PDFManager
        label="PDF(s) de la Cotización"
        files={cotPDFs}
        onChange={(files)=>setCot(prev=>({...prev, pdfs: typeof files === "function" ? files(cotPDFs) : files}))}
      />

      {/* OC */}
      <div className="space-y-2">
        <h4 className="font-semibold">OC del Cliente</h4>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Código">
            {edit ? <Input value={oc.codigo||""} onChange={e=>setOCO({ codigo: e.target.value })} /> : <div>{oc.codigo || "—"}</div>}
          </Field>
          <Field label="Monto (registro)">
            {edit ? <Input type="number" value={Number(oc.monto||0)} onChange={e=>setOCO({ monto: Number(e.target.value) })} /> : <div>{fmtMoney(Number(oc.monto||0))}</div>}
          </Field>
        </div>
        <PDFManager
          label="PDF(s) de la OC del Cliente"
          files={oc.pdfs || []}
          onChange={(files)=>setOCO({ pdfs: typeof files === "function" ? files(oc.pdfs||[]) : files })}
        />
      </div>

      {/* OT */}
      <div>
        <h4 className="font-semibold mb-2">Orden de Trabajo (OT)</h4>
        <div className="flex items-center gap-3 mb-2">
          <Field label="Fecha OT">
            {edit ? (
              <Input type="date" value={cot?.ot?.fecha || todayISO()} onChange={e=>setOT({ ...(cot.ot||{}), fecha:e.target.value })} />
            ) : (<div>{cot?.ot?.fecha || "—"}</div>)}
          </Field>
          {edit && <Button variant="secondary" className="gap-2" onClick={addItem}><Plus size={16}/> Agregar Servicio</Button>}
        </div>
        <Card className="bg-white border border-neutral-200">
          <CardContent className="p-0">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="w-24 text-right">Cantidad</TableHead>
                  <TableHead className="w-36 text-right">Costo Unit.</TableHead>
                  <TableHead className="w-36 text-right">Subtotal</TableHead>
                  {edit && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(cot.ot?.items||[]).map(it => (
                  <TableRow key={it.id} className="hover:bg-neutral-50">
                    <TableCell>{edit ? <Input value={it.descripcion} onChange={e=>upItem(it.id, { descripcion:e.target.value })} /> : it.descripcion}</TableCell>
                    <TableCell className="text-right">{edit ? <Input type="number" value={it.cantidad} onChange={e=>upItem(it.id, { cantidad:Number(e.target.value) })} /> : it.cantidad}</TableCell>
                    <TableCell className="text-right">{edit ? <Input type="number" value={it.costo} onChange={e=>upItem(it.id, { costo:Number(e.target.value) })} /> : fmtMoney(it.costo)}</TableCell>
                    <TableCell className="text-right font-medium">{fmtMoney(Number(it.cantidad||0)*Number(it.costo||0))}</TableCell>
                    {edit && <TableCell><Button size="icon" variant="ghost" onClick={()=>rmItem(it.id)}><Trash2 size={16}/></Button></TableCell>}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-medium">Total OT</TableCell>
                  <TableCell className="text-right font-semibold">{fmtMoney(otTotal)}</TableCell>
                  {edit && <TableCell></TableCell>}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="mt-3">
          <PDFManager
            label="PDF(s) de la OT"
            files={otPDFs}
            onChange={(files)=>setOT({ ...(cot.ot||{}), pdfs: typeof files === "function" ? files(otPDFs) : files })}
          />
        </div>
      </div>

      {/* Factura */}
      <div>
        <h4 className="font-semibold mb-2">Factura de Venta</h4>
        <div className="grid md:grid-cols-3 gap-4">
          <Field label="Fecha Factura">
            {edit ? <Input type="date" value={cot?.factura?.fecha || todayISO()} onChange={e=>setFactura({ fecha:e.target.value })} /> : <div>{cot?.factura?.fecha || "—"}</div>}
          </Field>
          <Field label={`Total (con IVA)`}>
            {edit ? <Input type="number" value={cot?.factura?.total || 0} onChange={e=>setFactura({ total:Number(e.target.value) })} /> : <div>{fmtMoney(Number(cot?.factura?.total||0))}</div>}
          </Field>
          <SumBox title={`Utilidad ${usarNetoSinIVA?"(usa neto)":""}`} value={fmtMoney(utilidad)} highlight />
        </div>

        <div className="mt-2">
          <PDFManager
            label="PDF(s) de la Factura"
            files={factPDFs}
            onChange={(files)=>setFactura({ pdfs: typeof files === "function" ? files(factPDFs) : files })}
          />
        </div>
      </div>
    </div>
  );
}

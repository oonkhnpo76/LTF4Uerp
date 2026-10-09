import React, { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard, Truck, Receipt, CheckSquare, ClipboardCheck, Target,
  Plus, ArrowUpCircle, ArrowDownCircle, AlertTriangle,
  Trash2, Package, TrendingUp, TrendingDown, Minus,
  Upload, Download, Save, X, ChevronLeft, ChevronRight as ChevronRightIcon, Boxes,
  FileText, Copy, Check, StickyNote, Wallet, Megaphone, Pencil,
  CreditCard, Landmark, Users, CalendarDays, LayoutGrid, Wifi, WifiOff
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from "recharts";

/* ------------------------- Supabase (공유 데이터베이스) ------------------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_READY = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = SUPABASE_READY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const TABLE = "erp_data";

/*
  useSyncedState(key, seedFn)
  - 최초 1회: 테이블에서 해당 key row를 읽어온다. 없으면 seedFn()으로 시드 데이터를 만들어 저장한다.
  - 이후: 로컬에서 값이 바뀌면 자동으로 테이블에 upsert.
  - realtime 구독: 다른 팀원(다른 브라우저)이 같은 key를 바꾸면 postgres_changes 이벤트로 즉시 반영.
  - lastSynced ref로 "내가 막 반영한 값"을 기억해서, 되돌아오는 realtime 이벤트가 같은 내용이면
    다시 저장하지 않도록 막아 무한 루프(에코)를 방지한다.
*/
function useSyncedState(key, seedFn) {
  const [value, setValue] = useState(seedFn);
  const [ready, setReady] = useState(false);
  const lastSynced = useRef(null);

  useEffect(() => {
    let channel;
    let cancelled = false;

    (async () => {
      if (!SUPABASE_READY) {
        // 공유 DB가 설정되지 않은 경우: 로컬 전용(이 브라우저만) 모드로 동작
        setReady(true);
        return;
      }
      try {
        const { data, error } = await supabase.from(TABLE).select("value").eq("key", key).maybeSingle();
        if (cancelled) return;
        if (!error && data && data.value != null) {
          lastSynced.current = data.value;
          try { setValue(JSON.parse(data.value)); } catch { /* keep seed */ }
        } else {
          const seeded = seedFn();
          const json = JSON.stringify(seeded);
          lastSynced.current = json;
          setValue(seeded);
          await supabase.from(TABLE).upsert({ key, value: json, updated_at: new Date().toISOString() });
        }
      } catch {
        /* 네트워크 오류 등: 로컬 시드로 계속 진행 */
      } finally {
        if (!cancelled) setReady(true);
      }

      if (!cancelled) {
        channel = supabase
          .channel(`erp_data_${key}`)
          .on("postgres_changes", { event: "*", schema: "public", table: TABLE, filter: `key=eq.${key}` }, (payload) => {
            const newVal = payload.new && payload.new.value;
            if (newVal !== undefined && newVal !== lastSynced.current) {
              lastSynced.current = newVal;
              try { setValue(JSON.parse(newVal)); } catch { /* ignore malformed */ }
            }
          })
          .subscribe();
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!ready || !SUPABASE_READY) return;
    const json = JSON.stringify(value);
    if (json === lastSynced.current) return;
    lastSynced.current = json;
    supabase.from(TABLE).upsert({ key, value: json, updated_at: new Date().toISOString() }).then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ready]);

  return [value, setValue, ready];
}

/* ---------------------------------- 토큰 ---------------------------------- */
const C = {
  bg: "#F3F5F2",
  surface: "#FFFFFF",
  border: "#DEE3DC",
  ink: "#1E2A22",
  sub: "#5C6B60",
  faint: "#8B9A8F",
  primary: "#2E6B4C",
  primaryDark: "#1F4E37",
  primarySoft: "#E4EFE7",
  amber: "#C97A2B",
  amberSoft: "#F6E7D6",
  red: "#B3452F",
  redSoft: "#F5E1DB",
  navy: "#33475B",
  navySoft: "#E6EAF0",
  purple: "#6B4C7A",
  purpleSoft: "#EDE6F0",
  teal: "#2E7A6B",
  tealSoft: "#E1F0EC",
  chestnut: "#93664A",
  chestnutSoft: "#F1E6DD",
  blue: "#2E5FA3",
  blueSoft: "#E3EAF6",
  pink: "#C23B7A",
  pinkSoft: "#F5E1EC",
};
const FONT = `"Pretendard","Apple SD Gothic Neo","Malgun Gothic",-apple-system,sans-serif`;
const MONO = `"IBM Plex Mono","SFMono-Regular",Consolas,monospace`;

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const won = (n) => `₩${Number(n || 0).toLocaleString("ko-KR")}`;
const truncate = (s, n) => (!s ? "" : s.length > n ? s.slice(0, n) + "…" : s);
const manwon = (n) => `${Math.round((n || 0) / 10000).toLocaleString()}만`;
const monthKey = (dateStr) => (dateStr || "").slice(0, 7);
const downloadCSV = (rows, filename) => {
  const csv = Papa.unparse(rows);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};
const dayKR = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  return ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][dt.getDay()];
};
const dayKRshort = (dateStr) => dayKR(dateStr).slice(0, 1);

/* -------------------------------- 시드 데이터 -------------------------------- */
const seedInventory = () => ([
  { id: uid(), name: "박력분(밀가루)", category: "원재료", qty: 1200, unit: "kg", safety: 800, location: "원료창고A" },
  { id: uid(), name: "정제소금", category: "원재료", qty: 150, unit: "kg", safety: 300, location: "원료창고A" },
  { id: uid(), name: "식용유", category: "원재료", qty: 600, unit: "L", safety: 400, location: "원료창고B" },
  { id: uid(), name: "백설탕", category: "원재료", qty: 900, unit: "kg", safety: 500, location: "원료창고A" },
  { id: uid(), name: "감자스낵(완제품)", category: "완제품", qty: 3200, unit: "box", safety: 2000, location: "완제품창고" },
  { id: uid(), name: "크림소스(완제품)", category: "완제품", qty: 450, unit: "box", safety: 600, location: "완제품창고" },
  { id: uid(), name: "포장재-비닐", category: "부자재", qty: 5000, unit: "ea", safety: 3000, location: "부자재창고" },
]);

const seedMovements = () => ([
  { id: uid(), date: "2026-08-12", item: "박력분(밀가루)", type: "입고", qty: 500, partner: "대한제분(주)" },
  { id: uid(), date: "2026-08-12", item: "감자스낵(완제품)", type: "출고", qty: 800, partner: "이마트 물류센터" },
  { id: uid(), date: "2026-08-13", item: "정제소금", type: "입고", qty: 100, partner: "한주소금" },
  { id: uid(), date: "2026-08-13", item: "크림소스(완제품)", type: "출고", qty: 300, partner: "쿠팡 풀필먼트" },
  { id: uid(), date: "2026-08-14", item: "식용유", type: "입고", qty: 200, partner: "롯데푸드 원료팀" },
  { id: uid(), date: "2026-08-14", item: "감자스낵(완제품)", type: "출고", qty: 500, partner: "GS리테일 물류센터" },
]);

/* ============================= 회계관리: 신규 데이터모델 ============================= */
const seedSales = () => ([
  { id: uid(), no: 1, date: "2026-06-03", partner: "(주)한빛테크", item: "웹사이트 유지보수", supply: 3000000, vat: 300000, total: 3300000, memo: "6월" },
  { id: uid(), no: 2, date: "2026-06-10", partner: "대성상사", item: "사무용 가구 납품", supply: 1800000, vat: 180000, total: 1980000, memo: "6월" },
  { id: uid(), no: 3, date: "2026-06-18", partner: "그린푸드", item: "식자재 정기납품", supply: 2500000, vat: 250000, total: 2750000, memo: "6월" },
  { id: uid(), no: 4, date: "2026-06-25", partner: "서울물산", item: "포장재 납품", supply: 1200000, vat: 120000, total: 1320000, memo: "6월" },
  { id: uid(), no: 5, date: "2026-07-02", partner: "(주)한빛테크", item: "시스템 컨설팅", supply: 4500000, vat: 450000, total: 4950000, memo: "7월" },
  { id: uid(), no: 6, date: "2026-07-09", partner: "미래건설", item: "인테리어 자재 납품", supply: 3200000, vat: 320000, total: 3520000, memo: "7월" },
  { id: uid(), no: 7, date: "2026-07-17", partner: "그린푸드", item: "식자재 정기납품", supply: 2500000, vat: 250000, total: 2750000, memo: "7월" },
  { id: uid(), no: 8, date: "2026-07-28", partner: "대성상사", item: "사무용 가구 납품", supply: 2100000, vat: 210000, total: 2310000, memo: "7월" },
  { id: uid(), no: 9, date: "2026-08-04", partner: "서울물산", item: "포장재 납품", supply: 1500000, vat: 150000, total: 1650000, memo: "8월" },
  { id: uid(), no: 10, date: "2026-08-11", partner: "미래건설", item: "인테리어 자재 납품", supply: 2800000, vat: 280000, total: 3080000, memo: "8월" },
]);

const seedPurchases = () => ([
  { id: uid(), no: 1, date: "2026-06-05", partner: "대한자재", item: "원자재 매입", supply: 2000000, vat: 200000, total: 2200000, memo: "6월" },
  { id: uid(), no: 2, date: "2026-06-15", partner: "한국물류", item: "운송비", supply: 600000, vat: 60000, total: 660000, memo: "6월" },
  { id: uid(), no: 3, date: "2026-06-22", partner: "삼진전자", item: "사무기기 구입", supply: 1100000, vat: 110000, total: 1210000, memo: "6월" },
  { id: uid(), no: 4, date: "2026-07-03", partner: "대한자재", item: "원자재 매입", supply: 2300000, vat: 230000, total: 2530000, memo: "7월" },
  { id: uid(), no: 5, date: "2026-07-12", partner: "우리문구", item: "사무용품 구입", supply: 350000, vat: 35000, total: 385000, memo: "7월" },
  { id: uid(), no: 6, date: "2026-07-20", partner: "태양인쇄", item: "카탈로그 인쇄", supply: 800000, vat: 80000, total: 880000, memo: "7월" },
  { id: uid(), no: 7, date: "2026-08-02", partner: "한국물류", item: "운송비", supply: 700000, vat: 70000, total: 770000, memo: "8월" },
  { id: uid(), no: 8, date: "2026-08-09", partner: "대한자재", item: "원자재 매입", supply: 1900000, vat: 190000, total: 2090000, memo: "8월" },
]);

const seedDeposits = () => ([
  { id: uid(), no: 1, date: "2026-06-20", partner: "(주)한빛테크", saleNo: 1, amount: 3000000, bank: "국민은행-법인", category: "매출수금", memo: "6월 매출 전액 회수" },
  { id: uid(), no: 2, date: "2026-06-25", partner: "대성상사", saleNo: 2, amount: 1500000, bank: "국민은행-법인", category: "매출수금", memo: "일부 입금(분할)" },
  { id: uid(), no: 3, date: "2026-06-30", partner: "그린푸드", saleNo: 3, amount: 2500000, bank: "국민은행-법인", category: "매출수금", memo: "전액 회수" },
  { id: uid(), no: 4, date: "2026-07-15", partner: "(주)한빛테크", saleNo: 5, amount: 4500000, bank: "국민은행-법인", category: "매출수금", memo: "전액 회수" },
  { id: uid(), no: 5, date: "2026-07-22", partner: "미래건설", saleNo: 6, amount: 2000000, bank: "국민은행-법인", category: "매출수금", memo: "일부 입금" },
  { id: uid(), no: 6, date: "2026-07-31", partner: "그린푸드", saleNo: 7, amount: 2500000, bank: "국민은행-법인", category: "매출수금", memo: "전액 회수" },
  { id: uid(), no: 7, date: "2026-08-10", partner: "서울물산", saleNo: 9, amount: 1500000, bank: "국민은행-법인", category: "매출수금", memo: "8월 전액 회수" },
]);

const seedWithdrawals = () => ([
  { id: uid(), no: 1, date: "2026-06-25", partner: "대한자재", purchaseNo: 1, amount: 2000000, bank: "국민은행-법인", category: "매입지급", memo: "전액 지급" },
  { id: uid(), no: 2, date: "2026-06-28", partner: "한국물류", purchaseNo: 2, amount: 600000, bank: "국민은행-법인", category: "매입지급", memo: "전액 지급" },
  { id: uid(), no: 3, date: "2026-07-10", partner: "대한자재", purchaseNo: 4, amount: 1500000, bank: "국민은행-법인", category: "매입지급", memo: "일부 지급" },
  { id: uid(), no: 4, date: "2026-07-18", partner: "우리문구", purchaseNo: 5, amount: 350000, bank: "국민은행-법인", category: "매입지급", memo: "전액 지급" },
  { id: uid(), no: 5, date: "2026-07-26", partner: "태양인쇄", purchaseNo: 6, amount: 800000, bank: "국민은행-법인", category: "매입지급", memo: "전액 지급" },
  { id: uid(), no: 6, date: "2026-08-03", partner: "한국물류", purchaseNo: 7, amount: 700000, bank: "국민은행-법인", category: "원부자재", memo: "8월 전액 지급" },
]);

const seedCards = () => ([
  { id: uid(), no: 1, date: "2026-06-04", merchant: "GS칼텍스 역삼주유소", amount: 150000, card: "국민 법인카드", purpose: "업무용 차량 주유", memo: "" },
  { id: uid(), no: 2, date: "2026-06-12", merchant: "이마트 강남점", amount: 220000, card: "국민 법인카드", purpose: "사무실 소모품", memo: "" },
  { id: uid(), no: 3, date: "2026-06-20", merchant: "한식당 미가", amount: 180000, card: "국민 법인카드", purpose: "거래처 접대", memo: "" },
  { id: uid(), no: 4, date: "2026-07-02", merchant: "KTX", amount: 95000, card: "국민 법인카드", purpose: "출장 교통비", memo: "" },
  { id: uid(), no: 5, date: "2026-07-14", merchant: "GS칼텍스 역삼주유소", amount: 160000, card: "국민 법인카드", purpose: "업무용 차량 주유", memo: "" },
  { id: uid(), no: 6, date: "2026-07-25", merchant: "스타벅스 삼성점", amount: 45000, card: "국민 법인카드", purpose: "회의용 음료", memo: "" },
  { id: uid(), no: 7, date: "2026-08-03", merchant: "이마트 강남점", amount: 310000, card: "국민 법인카드", purpose: "사무실 소모품", memo: "" },
  { id: uid(), no: 8, date: "2026-08-12", merchant: "한식당 미가", amount: 200000, card: "국민 법인카드", purpose: "거래처 접대", memo: "" },
]);

const seedBankTxns = () => ([
  { id: uid(), date: "2026-06-20", type: "입금", desc: "(주)한빛테크 매출대금", amount: 3000000 },
  { id: uid(), date: "2026-06-25", type: "입금", desc: "대성상사 매출대금(일부)", amount: 1500000 },
  { id: uid(), date: "2026-06-25", type: "출금", desc: "대한자재 매입대금", amount: 2000000 },
  { id: uid(), date: "2026-06-28", type: "출금", desc: "한국물류 운송비", amount: 600000 },
  { id: uid(), date: "2026-06-28", type: "출금", desc: "6월 사무실 임대료", amount: 1500000 },
  { id: uid(), date: "2026-06-30", type: "입금", desc: "그린푸드 매출대금", amount: 2500000 },
  { id: uid(), date: "2026-07-10", type: "출금", desc: "대한자재 매입대금(일부)", amount: 1500000 },
  { id: uid(), date: "2026-07-15", type: "입금", desc: "(주)한빛테크 매출대금", amount: 4500000 },
  { id: uid(), date: "2026-07-18", type: "출금", desc: "우리문구 매입대금", amount: 350000 },
  { id: uid(), date: "2026-07-22", type: "입금", desc: "미래건설 매출대금(일부)", amount: 2000000 },
  { id: uid(), date: "2026-07-25", type: "출금", desc: "태양인쇄 매입대금", amount: 800000 },
  { id: uid(), date: "2026-07-28", type: "출금", desc: "7월 사무실 임대료", amount: 1500000 },
  { id: uid(), date: "2026-07-31", type: "입금", desc: "그린푸드 매출대금", amount: 2500000 },
  { id: uid(), date: "2026-08-05", type: "출금", desc: "법인카드 6월 사용대금 결제", amount: 795000 },
  { id: uid(), date: "2026-08-08", type: "출금", desc: "한국물류 운송비", amount: 700000 },
  { id: uid(), date: "2026-08-10", type: "입금", desc: "서울물산 매출대금", amount: 1500000 },
]);

const seedBankOpening = () => 10000000;


const STAGES = ["주문", "재고", "생산", "출고", "매출", "세금계산서", "입금", "미수금"];
const STAGE_COLORS = [C.navy, C.primary, C.teal, C.amber, C.primaryDark, C.purple, C.red, "#8A6D3B"];

const STATUS_LIST = ["대기", "진행중", "완료", "보류", "미분류"];
const STATUS_STYLE = {
  대기: { bg: "#FFF4CC", fg: "#8A6D1D" },
  진행중: { bg: "#DDEBFF", fg: "#174A8B" },
  완료: { bg: "#DFF3E2", fg: "#1F6B3D" },
  보류: { bg: "#FCE2E2", fg: "#8C2F39" },
  미분류: { bg: "#ECECEC", fg: "#505050" },
};
const PRIORITY_BADGE = {
  상: { bg: "#D7263D", fg: "#FFFFFF" },
  중: { bg: "#F59E0B", fg: "#FFFFFF" },
  하: { bg: "#94A3B8", fg: "#FFFFFF" },
};

const seedTodos = () => ([
  { id: uid(), title: "GS리테일 감자스낵 2,000box 신규주문 등록", assignee: "정재연 과장", due: "2026-08-18", priority: "상", stage: "주문", status: "대기", createdAt: "2026-08-10", doneAt: "", memo: "발주서 수신 확인 완료, 시스템 입력 필요" },
  { id: uid(), title: "크림소스 재고 부족분 확인", assignee: "박주임", due: "2026-08-16", priority: "상", stage: "재고", status: "진행중", createdAt: "2026-08-11", doneAt: "", memo: "안전재고 대비 150box 부족, 생산팀 공유 완료" },
  { id: uid(), title: "감자스낵 2차 생산 지시", assignee: "이사원", due: "2026-08-19", priority: "중", stage: "생산", status: "대기", createdAt: "2026-08-12", doneAt: "", memo: "" },
  { id: uid(), title: "이마트 물류센터 출고 스케줄 조정", assignee: "박주임", due: "2026-08-15", priority: "중", stage: "출고", status: "완료", createdAt: "2026-08-13", doneAt: "2026-08-15", memo: "8/15 오전 출고 완료" },
  { id: uid(), title: "8월 매출 마감 데이터 취합", assignee: "김대리", due: "2026-08-25", priority: "상", stage: "매출", status: "대기", createdAt: "2026-08-13", doneAt: "", memo: "" },
  { id: uid(), title: "쿠팡(주) 세금계산서 발행", assignee: "김대리", due: "2026-08-16", priority: "상", stage: "세금계산서", status: "진행중", createdAt: "2026-08-14", doneAt: "", memo: "발행 전 공급가액 재확인 필요" },
  { id: uid(), title: "이마트(주) 입금 확인", assignee: "정재연 과장", due: "2026-08-20", priority: "중", stage: "입금", status: "대기", createdAt: "2026-08-14", doneAt: "", memo: "" },
  { id: uid(), title: "GS리테일 미수금 잔액 확인 및 독촉", assignee: "이사원", due: "2026-08-22", priority: "하", stage: "미수금", status: "보류", createdAt: "2026-08-10", doneAt: "", memo: "지난달 미수금 잔액 있음, 재무팀 협의" },
]);

const PERIODS = ["일일", "주간", "월간"];
const DEPTS = ["회계", "물류", "인사"];
const PERIOD_COLORS = { 일일: C.primary, 주간: C.amber, 월간: C.purple };
const DEPT_COLORS = { 회계: C.amber, 물류: C.primary, 인사: C.navy };

const seedChecklist = () => ([
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "08:30~09:00", category: "당일 운영", task: "오늘 입고 예정 / 출고 예정 / 긴급 요청 확인", done: true, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "09:00~09:30", category: "재고", task: "재고 부족 품목 확인 및 우선 대응", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "09:30~10:00", category: "발주", task: "원부자재/완제품 발주 필요 수량 점검 및 발주", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "10:00~10:30", category: "배차예약", task: "당일 출고 배차예약 및 시간 확정", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "10:30~11:00", category: "입고관리", task: "입고 수량/LOT/유통기한 확인 및 반영", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "11:00~11:30", category: "입출고 현황", task: "입출고 현황 업데이트 및 누락 체크", done: false, memo: "", priority: "중", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "11:30~12:00", category: "문서", task: "거래명세서 1차 작성/발송", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "13:00~13:30", category: "원장", task: "매출거래처 원장 업데이트", done: true, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "13:30~14:00", category: "수불부", task: "수불부 반영 및 재고 차이 확인", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "14:00~14:30", category: "회계정산", task: "회계정산 자료 취합 및 확인", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "14:30~15:00", category: "전표", task: "파렛트 이동전표 정리 및 누락 확인", done: false, memo: "", priority: "중", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "인사", timeSlot: "15:00~15:30", category: "이체/급여", task: "이체 건 확인 / 급여 관련 처리", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "15:30~16:00", category: "증빙", task: "거래명세서/증빙 누락분 재확인", done: false, memo: "", priority: "중", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "16:00~16:30", category: "마감", task: "마감장 발송", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "16:30~17:00", category: "회신관리", task: "마감장 회신 확인 및 미회신 거래처 체크", done: false, memo: "", priority: "상", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "일일", dept: "물류", timeSlot: "17:00~17:30", category: "내일준비", task: "내일 선확인/선발주/특이사항 메모", done: false, memo: "", priority: "중", assignee: "정재연 과장" },
  { id: uid(), date: "2026-08-10", period: "주간", dept: "회계", timeSlot: "", category: "주간마감", task: "주간 매출/매입 마감 검토", done: false, memo: "", priority: "상", assignee: "김대리" },
  { id: uid(), date: "2026-08-10", period: "주간", dept: "물류", timeSlot: "", category: "재고실사", task: "주간 재고 실사 및 안전재고 재산정", done: false, memo: "", priority: "중", assignee: "박주임" },
  { id: uid(), date: "2026-08-10", period: "주간", dept: "인사", timeSlot: "", category: "근태관리", task: "주간 근태 현황 정리 및 특이사항 보고", done: false, memo: "", priority: "중", assignee: "이사원" },
  { id: uid(), date: "2026-08-01", period: "월간", dept: "회계", timeSlot: "", category: "월마감", task: "월마감 결산 및 세금계산서 합계표 제출", done: false, memo: "", priority: "상", assignee: "김대리" },
  { id: uid(), date: "2026-08-01", period: "월간", dept: "물류", timeSlot: "", category: "재고실사", task: "월간 재고 실사 및 폐기/손실 정산", done: false, memo: "", priority: "상", assignee: "박주임" },
  { id: uid(), date: "2026-08-01", period: "월간", dept: "인사", timeSlot: "", category: "급여/보험", task: "월간 급여 정산 및 4대보험 신고", done: false, memo: "", priority: "상", assignee: "이사원" },
]);

const seedBudget = () => 8000000;

const seedCeoNotes = () => ([
  { id: uid(), date: "2026-08-14", text: "이번달 물류비 절감안 다음주까지 정리해서 보고" },
]);

const seedMyNotes = () => ([
  { id: uid(), date: "2026-08-13", text: "크림소스 거래처 단가 재협상 건 — 다음주 화요일까지 회신 필요" },
]);

const seedReports = () => ([
  {
    id: uid(), date: "2026-08-14", orderStatus: "정상", prodStatus: "정상", shipStatus: "지연",
    salesWon: 2035, collectedWon: 0, receivableWon: 2035,
    orderNeed: "정제소금, 크림소스(완제품) 발주 필요", note: "이마트 물류센터 출고 차량 배차 지연으로 30분 늦게 출발",
    decision: "다음 출고부터는 배차예약을 전일 확정하도록 지시", savedAt: "2026-08-14T18:00:00.000Z",
  },
]);

const seedOkrs = () => ([
  {
    id: uid(), quarter: "2026 Q3", title: "물류 리드타임 단축으로 재고 비용 절감", owner: "정재연 과장",
    krs: [
      { id: uid(), title: "평균 입고 리드타임 5.2일 → 3.5일", progress: 60 },
      { id: uid(), title: "안전재고 미달 품목 0건 유지", progress: 40 },
      { id: uid(), title: "창고 회전율 15% 개선", progress: 25 },
    ],
  },
  {
    id: uid(), quarter: "2026 Q3", title: "회계 마감 프로세스 자동화", owner: "김대리",
    krs: [
      { id: uid(), title: "월마감 소요일 D+7 → D+3", progress: 70 },
      { id: uid(), title: "전표 오류율 2% 미만", progress: 55 },
    ],
  },
]);

/* --------------------------------- 공통 UI --------------------------------- */
function Badge({ children, tone = "sub" }) {
  const tones = {
    sub: { bg: "#EEF1EE", fg: C.sub },
    primary: { bg: C.primarySoft, fg: C.primaryDark },
    amber: { bg: C.amberSoft, fg: C.amber },
    red: { bg: C.redSoft, fg: C.red },
    navy: { bg: C.navySoft, fg: C.navy },
    purple: { bg: C.purpleSoft, fg: C.purple },
    teal: { bg: C.tealSoft, fg: C.teal },
    pink: { bg: C.pinkSoft, fg: C.pink },
    blue: { bg: C.blueSoft, fg: C.blue },
  };
  const t = tones[tone] || tones.sub;
  return (
    <span style={{
      background: t.bg, color: t.fg, fontSize: 12, fontWeight: 600,
      padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Card({ children, style }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
      padding: 20, ...style,
    }}>{children}</div>
  );
}

function SectionTitle({ icon: Icon, title, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
      {Icon && <Icon size={20} color={C.primary} />}
      <h2 style={{ fontSize: 19, fontWeight: 800, color: C.ink, margin: 0 }}>{title}</h2>
      {sub && <span style={{ fontSize: 13, color: C.faint, marginLeft: 4 }}>{sub}</span>}
    </div>
  );
}

function GaugeBar({ qty, safety }) {
  const ratio = safety > 0 ? qty / safety : 1;
  const pct = Math.min(ratio * 100, 130);
  let color = C.primary;
  let label = "정상";
  if (ratio < 1) { color = C.red; label = "부족"; }
  else if (ratio < 1.2) { color = C.amber; label = "주의"; }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 160 }}>
      <div style={{ flex: 1, height: 8, background: "#EDEFEA", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28 }}>{label}</span>
    </div>
  );
}

function IconBtn({ onClick, children, danger, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      border: "none", background: "transparent", cursor: "pointer",
      color: danger ? C.red : C.faint, display: "flex", alignItems: "center", padding: 4,
    }}>{children}</button>
  );
}

const inputStyle = {
  border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 13, fontFamily: FONT, color: C.ink, background: "#FBFBFA", outline: "none",
};
const btnPrimary = {
  background: C.primary, color: "#fff", border: "none", borderRadius: 8,
  padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 6,
};
const btnGhost = {
  background: "#fff", color: C.sub, border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
  display: "flex", alignItems: "center", gap: 6,
};

/* ------------------------------ 마인드맵 레이아웃 ------------------------------ */
function layoutRadialTree(root, { width, height, radiusStep }) {
  const center = { x: width / 2, y: height / 2 };
  const nodes = [];
  const links = [];
  const countLeaves = (n) => (!n.children || !n.children.length ? 1 : n.children.reduce((s, c) => s + countLeaves(c), 0));
  const place = (node, depth, aStart, aEnd, parent) => {
    const angle = (aStart + aEnd) / 2;
    const r = depth * radiusStep;
    const x = center.x + r * Math.cos(angle);
    const y = center.y + r * Math.sin(angle);
    const n = { ...node, _x: x, _y: y, _depth: depth, _angle: angle };
    nodes.push(n);
    if (parent) links.push({ x1: parent._x, y1: parent._y, x2: x, y2: y });
    const children = node.children || [];
    if (children.length) {
      const total = children.reduce((s, c) => s + countLeaves(c), 0);
      let cursor = aStart;
      children.forEach((c) => {
        const w = countLeaves(c);
        const slice = (aEnd - aStart) * (w / total);
        place(c, depth + 1, cursor, cursor + slice, n);
        cursor += slice;
      });
    }
  };
  place(root, 0, -Math.PI, Math.PI, null);
  return { nodes, links, center };
}

function MindMap({ tree, width = 1000, height = 640, radiusStep = 140, onLeafClick, selectedId }) {
  const { nodes, links, center } = layoutRadialTree(tree, { width, height, radiusStep });
  const svgRef = useRef(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef({ active: false, startX: 0, startY: 0, panStart: { x: 0, y: 0 } });
  const [isDragging, setIsDragging] = useState(false);

  const onDown = (e) => {
    drag.current.active = true;
    drag.current.startX = e.clientX;
    drag.current.startY = e.clientY;
    drag.current.panStart = { ...pan };
    setIsDragging(true);
  };
  const onMove = (e) => {
    if (!drag.current.active || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scale = width / rect.width;
    const dx = (e.clientX - drag.current.startX) * scale;
    const dy = (e.clientY - drag.current.startY) * scale;
    setPan({ x: drag.current.panStart.x + dx, y: drag.current.panStart.y + dy });
  };
  const endDrag = () => { drag.current.active = false; setIsDragging(false); };

  return (
    <div style={{ position: "relative" }}>
      {(pan.x !== 0 || pan.y !== 0) && (
        <button onClick={() => setPan({ x: 0, y: 0 })} style={{
          position: "absolute", top: 6, right: 6, zIndex: 2, border: `1px solid ${C.border}`,
          background: "#fff", color: C.sub, borderRadius: 7, padding: "4px 9px", fontSize: 11,
          fontWeight: 700, cursor: "pointer",
        }}>보드 위치 초기화</button>
      )}
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={endDrag} onMouseLeave={endDrag}>
      <g transform={`translate(${pan.x},${pan.y})`}>
      {links.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={C.border} strokeWidth={1.4} />
      ))}
      {nodes.map((n) => {
        const isLeaf = !n.children || n.children.length === 0;
        const isRoot = n._depth === 0;
        let r = 16;
        if (isRoot) r = 30;
        else if (!isLeaf) r = n._depth === 1 ? 18 : 13;
        else r = n.data ? { 상: 9, 중: 7, 하: 5.5 }[n.data.priority] || 7 : 7;

        let fill = n.color || C.sub;
        let stroke = "none";
        let strokeWidth = 0;
        if (isRoot) fill = C.primaryDark;
        if (isLeaf) {
          const done = n.data && n.data.done;
          const pcolor = n.data ? { 상: C.red, 중: C.amber, 하: C.faint }[n.data.priority] || C.faint : C.faint;
          fill = done ? C.primary : "#fff";
          stroke = pcolor; strokeWidth = 2;
        }
        const isSelected = selectedId && n.id === selectedId;
        const labelLeft = n._x < center.x;
        return (
          <g key={n.id + n._depth} transform={`translate(${n._x},${n._y})`}
            style={{ cursor: isLeaf ? "pointer" : "default" }}
            onClick={() => isLeaf && onLeafClick && onLeafClick(n)}>
            {isSelected && <circle r={r + 5} fill="none" stroke={C.primary} strokeWidth={2} strokeDasharray="3 3" />}
            <circle r={r} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
            {!isLeaf && (
              <text textAnchor="middle" dy={4} fontSize={isRoot ? 12.5 : n._depth === 1 ? 11.5 : 10.5}
                fontWeight={800} fill={isRoot ? "#fff" : "#fff"}>
                {truncate(n.label, isRoot ? 10 : 8)}
              </text>
            )}
            {isLeaf && (
              <text x={labelLeft ? -(r + 6) : r + 6} textAnchor={labelLeft ? "end" : "start"} dy={4}
                fontSize={10.5} fontWeight={n.data && n.data.done ? 400 : 600} fill={n.data && n.data.done ? C.faint : C.ink}
                style={{ textDecoration: n.data && n.data.done ? "line-through" : "none" }}>
                {truncate(n.label, 20)}
              </text>
            )}
          </g>
        );
      })}
      </g>
      </svg>
    </div>
  );
}

/* -------------------------------- 대시보드 (회계 요약 · 메모) -------------------------------- */
function NoteList({ notes, setNotes, color, placeholder, icon: Icon }) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDate, setEditDate] = useState("");
  const add = () => {
    if (!text.trim()) return;
    setNotes(n => [{ id: uid(), date: today(), text: text.trim() }, ...n]);
    setText("");
  };
  const remove = (id) => setNotes(n => n.filter(x => x.id !== id));
  const startEditDate = (n) => { setEditingId(n.id); setEditDate(n.date); };
  const saveDate = () => {
    setNotes(n => n.map(x => x.id === editingId ? { ...x, date: editDate } : x));
    setEditingId(null);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder}
          onKeyDown={e => e.key === "Enter" && add()}
          style={{ ...inputStyle, flex: 1 }} />
        <button style={{ ...btnPrimary, background: color }} onClick={add}><Plus size={14} />추가</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 260, overflowY: "auto" }}>
        {notes.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>메모가 없습니다.</div>}
        {notes.map(n => (
          <div key={n.id} style={{
            display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 10px",
            background: "#FAFAF8", border: `1px solid ${C.border}`, borderRadius: 10,
          }}>
            {Icon && <Icon size={14} color={color} style={{ flexShrink: 0, marginTop: 2 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === n.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)}
                    style={{ ...inputStyle, padding: "3px 6px", fontSize: 11 }} />
                  <IconBtn title="저장" onClick={saveDate}><Check size={13} color={color} /></IconBtn>
                  <IconBtn title="취소" onClick={() => setEditingId(null)}><X size={13} /></IconBtn>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10.5, color: C.faint, fontFamily: MONO }}>{n.date}</span>
                  <IconBtn title="날짜 수정" onClick={() => startEditDate(n)}><Pencil size={11} /></IconBtn>
                </div>
              )}
              <div style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5 }}>{n.text}</div>
            </div>
            <IconBtn danger onClick={() => remove(n.id)}><X size={13} /></IconBtn>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- 지출/입금 캘린더 -------------------------------- */
function CalendarView({ year, month, expenseItemsByDate, depositItemsByDate, selectedDate, onSelectDate }) {
  const manwon = (n) => `${Math.round(n / 10000).toLocaleString()}만`;
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const WD = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
        {WD.map((w, i) => (
          <div key={w} style={{
            textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0",
            color: i === 0 ? C.red : i === 6 ? C.blue : C.faint,
          }}>{w}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
          {week.map((d, di) => {
            if (!d) return <div key={di} />;
            const key = dateKey(d);
            const expItems = expenseItemsByDate[key] || [];
            const depItems = depositItemsByDate[key] || [];
            const expTotal = expItems.reduce((s, v) => s + v.amount, 0);
            const depTotal = depItems.reduce((s, v) => s + v.amount, 0);
            const chips = [
              ...expItems.map(v => ({ ...v, kind: "exp" })),
              ...depItems.map(v => ({ ...v, kind: "dep" })),
            ].sort((a, b) => b.amount - a.amount);
            const shown = chips.slice(0, 2);
            const rest = chips.length - shown.length;
            const isToday = key === today();
            const isSelected = key === selectedDate;
            return (
              <button key={di} onClick={() => onSelectDate(isSelected ? null : key)} style={{
                minHeight: 84, textAlign: "left", padding: "6px 6px", cursor: "pointer",
                borderRadius: 9, border: isSelected ? `1.5px solid ${C.primary}` : `1px solid ${isToday ? C.chestnut : C.border}`,
                background: isSelected ? C.primarySoft : isToday ? C.chestnutSoft : "#fff",
                display: "flex", flexDirection: "column", gap: 3, fontFamily: FONT, overflow: "hidden",
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: di === 0 ? C.red : di === 6 ? C.blue : C.ink,
                }}>{d}</span>
                {(expTotal > 0 || depTotal > 0) && (
                  <span style={{ fontSize: 10, fontFamily: MONO, fontWeight: 800, display: "flex", gap: 6 }}>
                    {expTotal > 0 && <span style={{ color: C.blue }}>-{manwon(expTotal)}</span>}
                    {depTotal > 0 && <span style={{ color: C.red }}>+{manwon(depTotal)}</span>}
                  </span>
                )}
                {shown.map((c, i) => (
                  <span key={i} style={{
                    fontSize: 9.5, fontWeight: 700, padding: "2px 5px", borderRadius: 5,
                    background: c.kind === "exp" ? C.blueSoft : C.redSoft, color: c.kind === "exp" ? C.blue : C.red,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", justifyContent: "space-between", gap: 4,
                  }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.desc}</span>
                    <span style={{ flexShrink: 0 }}>{manwon(c.amount)}</span>
                  </span>
                ))}
                {rest > 0 && <span style={{ fontSize: 9, color: C.faint }}>외 {rest}건</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Dashboard({ withdrawals, cards, deposits, budget, setBudget, ceoNotes, setCeoNotes, myNotes, setMyNotes }) {
  const [cal, setCal] = useState(() => {
    const d = new Date(today());
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(null);

  const actualExpensesAll = [
    ...withdrawals.map(w => ({ id: w.id, date: w.date, partner: w.partner, desc: w.memo || w.category || "출금", amount: w.amount, kind: "출금" })),
    ...cards.map(c => ({ id: c.id, date: c.date, partner: c.merchant, desc: c.memo || c.purpose || "법인카드", amount: c.amount, kind: "법인카드" })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const actualTotal = actualExpensesAll.reduce((s, v) => s + v.amount, 0);

  const depositsAll = deposits.map(d => ({ id: d.id, date: d.date, partner: d.partner, desc: d.memo || d.category || "입금", amount: d.amount }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const depositTotal = depositsAll.reduce((s, v) => s + v.amount, 0);

  const expenseItemsByDate = {};
  actualExpensesAll.forEach(v => { (expenseItemsByDate[v.date] = expenseItemsByDate[v.date] || []).push(v); });
  const depositItemsByDate = {};
  depositsAll.forEach(v => { (depositItemsByDate[v.date] = depositItemsByDate[v.date] || []).push(v); });

  const actualExpenses = selectedDate ? actualExpensesAll.filter(v => v.date === selectedDate) : actualExpensesAll;
  const depositList = selectedDate ? depositsAll.filter(v => v.date === selectedDate) : depositsAll;

  const pct = budget > 0 ? Math.min(Math.round((actualTotal / budget) * 100), 999) : 0;
  const overBudget = budget > 0 && actualTotal > budget;

  const monthLabel = `${cal.y}년 ${cal.m + 1}월`;
  const shiftMonth = (delta) => setCal(c => {
    const nm = c.m + delta;
    if (nm < 0) return { y: c.y - 1, m: 11 };
    if (nm > 11) return { y: c.y + 1, m: 0 };
    return { y: c.y, m: nm };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={LayoutDashboard} title="대시보드" sub="지출예산 · 실제지출 · 입금 · 메모" />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Wallet size={16} color={C.chestnut} />
              <span style={{ fontSize: 12.5, color: C.chestnut, fontWeight: 700 }}>이번달 지출예상 금액</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 15, color: C.chestnut, fontWeight: 700 }}>₩</span>
              <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))}
                style={{
                  ...inputStyle, width: 180, fontSize: 20, fontWeight: 800, fontFamily: MONO,
                  color: C.chestnut, background: C.chestnutSoft, border: `1px solid ${C.chestnut}55`,
                }} />
            </div>
          </div>
          <div style={{ minWidth: 220, flex: 1, maxWidth: 320 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: C.faint, marginBottom: 6 }}>
              <span>실제 지출 {won(actualTotal)}</span>
              <span style={{ color: overBudget ? C.red : C.faint, fontWeight: 700 }}>{pct}%</span>
            </div>
            <div style={{ height: 9, background: "#EDEFEA", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: overBudget ? C.red : C.chestnut, borderRadius: 999 }} />
            </div>
            {overBudget && <div style={{ fontSize: 11, color: C.red, marginTop: 4, fontWeight: 700 }}>예산 초과 ({won(actualTotal - budget)})</div>}
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IconBtn onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></IconBtn>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{monthLabel}</span>
            <IconBtn onClick={() => shiftMonth(1)}><ChevronRightIcon size={16} /></IconBtn>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.sub }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.blue, display: "inline-block" }} />지출
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.sub }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: C.red, display: "inline-block" }} />입금
            </span>
            {selectedDate && <button style={{ ...btnGhost, padding: "5px 10px" }} onClick={() => setSelectedDate(null)}><X size={12} />선택 해제</button>}
          </div>
        </div>
        <CalendarView year={cal.y} month={cal.m} expenseItemsByDate={expenseItemsByDate} depositItemsByDate={depositItemsByDate}
          selectedDate={selectedDate} onSelectDate={setSelectedDate} />
      </Card>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.blue, marginBottom: 10 }}>
            실제 지출 내역{selectedDate ? ` (${selectedDate})` : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {actualExpenses.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>지출 내역이 없습니다.</div>}
            {actualExpenses.map(v => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ color: C.faint, fontFamily: MONO, fontSize: 11, width: 78 }}>{v.date}</span>
                <Badge tone={v.kind === "법인카드" ? "navy" : "amber"}>{v.kind}</Badge>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.ink }}>{v.partner} · {v.desc}</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: C.blue }}>{won(v.amount)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.blue }}>합계 {won(actualExpenses.reduce((s, v) => s + v.amount, 0))}</span>
          </div>
        </Card>

        <Card style={{ flex: 1, minWidth: 320 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.red, marginBottom: 10 }}>
            입금 내역{selectedDate ? ` (${selectedDate})` : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {depositList.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>입금 내역이 없습니다.</div>}
            {depositList.map(v => (
              <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ color: C.faint, fontFamily: MONO, fontSize: 11, width: 78 }}>{v.date}</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.ink }}>{v.partner} · {v.desc}</span>
                <span style={{ fontFamily: MONO, fontWeight: 700, color: C.red }}>{won(v.amount)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: C.red }}>합계 {won(depositList.reduce((s, v) => s + v.amount, 0))}</span>
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Megaphone size={16} color={C.navy} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>대표님 지시사항</span>
          </div>
          <NoteList notes={ceoNotes} setNotes={setCeoNotes} color={C.navy} placeholder="대표님 지시사항을 입력하세요" icon={Megaphone} />
        </Card>
        <Card style={{ flex: 1, minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <StickyNote size={16} color={C.amber} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>나의 메모</span>
          </div>
          <NoteList notes={myNotes} setNotes={setMyNotes} color={C.amber} placeholder="잊지 말아야 할 내용을 메모하세요" icon={StickyNote} />
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------- 물류 탭 --------------------------------- */
function Logistics({ inventory, setInventory, movements, setMovements }) {
  const [form, setForm] = useState({ item: "", type: "입고", qty: "", partner: "" });
  const fileInputRef = useRef(null);
  const [cal, setCal] = useState(() => {
    const d = new Date(today());
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const monthLabel = `${cal.y}년 ${cal.m + 1}월`;
  const selMonthKey = `${cal.y}-${String(cal.m + 1).padStart(2, "0")}`;
  const shiftMonth = (delta) => setCal(c => {
    const nm = c.m + delta;
    if (nm < 0) return { y: c.y - 1, m: 11 };
    if (nm > 11) return { y: c.y + 1, m: 0 };
    return { y: c.y, m: nm };
  });

  const submit = () => {
    if (!form.item || !form.qty) return;
    const qtyNum = Number(form.qty);
    setMovements(m => [{ id: uid(), date: today(), ...form, qty: qtyNum }, ...m]);
    setInventory(inv => inv.map(i => i.name === form.item
      ? { ...i, qty: form.type === "입고" ? i.qty + qtyNum : Math.max(0, i.qty - qtyNum) }
      : i));
    setForm({ item: "", type: "입고", qty: "", partner: "" });
  };

  const monthMovements = movements.filter(m => m.date.slice(0, 7) === selMonthKey).sort((a, b) => b.date.localeCompare(a.date));
  const lowStock = inventory.filter((i) => i.qty < i.safety);
  const inCount = monthMovements.filter(m => m.type === "입고").length;
  const outCount = monthMovements.filter(m => m.type === "출고").length;
  const stockChart = inventory.map(i => ({ name: i.name.length > 6 ? i.name.slice(0, 6) + "…" : i.name, 현재고: i.qty, 안전재고: i.safety }));
  const pieData = [
    { name: "정상", value: inventory.length - lowStock.length },
    { name: "부족", value: lowStock.length },
  ];
  const PIE_COLORS = [C.primary, C.red];

  const stat = (label, value, icon, tone) => (
    <Card style={{ flex: 1, minWidth: 180 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, fontFamily: MONO, marginTop: 6 }}>{value}</div>
        </div>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: tone,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{icon}</div>
      </div>
    </Card>
  );

  const downloadXLSX = () => {
    const rows = inventory.map(i => ({ 품목명: i.name, 카테고리: i.category, 단위: i.unit, 현재고: i.qty, 안전재고: i.safety, 위치: i.location }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "재고");
    XLSX.writeFile(wb, `재고현황_${today()}.xlsx`);
  };
  const handleUploadClick = () => fileInputRef.current && fileInputRef.current.click();
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        setInventory(inv => {
          const updated = [...inv];
          rows.forEach(r => {
            const name = r["품목명"];
            if (!name) return;
            const idx = updated.findIndex(i => i.name === name);
            const item = {
              id: idx >= 0 ? updated[idx].id : uid(),
              name, category: r["카테고리"] || "", unit: r["단위"] || "",
              qty: Number(r["현재고"] || 0), safety: Number(r["안전재고"] || 0), location: r["위치"] || "",
            };
            if (idx >= 0) updated[idx] = item; else updated.push(item);
          });
          return updated;
        });
      } catch { /* ignore malformed file */ }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={Truck} title="물류 관리" sub="재고 · 입출고 · 재고상태 파악" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <IconBtn onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></IconBtn>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{monthLabel}</span>
          <IconBtn onClick={() => shiftMonth(1)}><ChevronRightIcon size={16} /></IconBtn>
        </div>
        <span style={{ fontSize: 11.5, color: C.faint }}>입출고 건수/내역은 선택한 월 기준입니다. 재고 현황은 실시간 스냅샷입니다.</span>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {stat("전체 품목 수", `${inventory.length}종`, <Boxes size={17} color={C.navy} />, C.navySoft)}
        {stat("재고 부족 품목", `${lowStock.length}건`, <AlertTriangle size={17} color={C.red} />, C.redSoft)}
        {stat(`${cal.m + 1}월 입고 건수`, `${inCount}건`, <ArrowDownCircle size={17} color={C.primary} />, C.primarySoft)}
        {stat(`${cal.m + 1}월 출고 건수`, `${outCount}건`, <ArrowUpCircle size={17} color={C.amber} />, C.amberSoft)}
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 2, minWidth: 360 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>품목별 현재고 vs 안전재고</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stockChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAEDE8" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: C.sub }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
              <Bar dataKey="현재고" fill={C.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="안전재고" fill={C.border} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 10 }}>재고 상태 분포</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {pieData.map((e, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>재고 현황</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFile} />
            <button style={btnGhost} onClick={handleUploadClick}><Upload size={13} />엑셀 업로드</button>
            <button style={btnGhost} onClick={downloadXLSX}><Download size={13} />엑셀 다운로드</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {inventory.map(i => (
            <div key={i.id} style={{
              display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.9fr 1.2fr 0.9fr", gap: 10,
              alignItems: "center", padding: "8px 0", borderBottom: `1px solid #F0F2EE`,
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: C.ink }}>{i.name}
                <div style={{ fontSize: 11, color: C.faint, fontWeight: 400 }}>{i.category} · {i.location}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: C.ink }}>{i.qty.toLocaleString()} {i.unit}</div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint }}>안전 {i.safety.toLocaleString()}</div>
              <GaugeBar qty={i.qty} safety={i.safety} />
              <div style={{ textAlign: "right" }}>
                {i.qty < i.safety ? <Badge tone="red">부족</Badge> : <Badge tone="primary">정상</Badge>}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 10 }}>
          엑셀 업로드 양식: 품목명, 카테고리, 단위, 현재고, 안전재고, 위치 (헤더 포함, 같은 품목명이 있으면 값이 갱신되고 없으면 새로 추가됩니다)
        </div>
      </Card>

      {lowStock.length > 0 && (
        <Card style={{ borderColor: C.redSoft }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertTriangle size={16} color={C.red} />
            <span style={{ fontWeight: 700, fontSize: 13, color: C.red }}>안전재고 미달 품목</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {lowStock.map(i => (
              <Badge key={i.id} tone="red">{i.name} · {i.qty}{i.unit} (안전 {i.safety}{i.unit})</Badge>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>입출고 등록</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <select value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} style={{ ...inputStyle, minWidth: 180 }}>
            <option value="">품목 선택</option>
            {inventory.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
          </select>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
            <option value="입고">입고</option>
            <option value="출고">출고</option>
          </select>
          <input placeholder="수량" type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
          <input placeholder="거래처" value={form.partner} onChange={e => setForm(f => ({ ...f, partner: e.target.value }))} style={{ ...inputStyle, minWidth: 160 }} />
          <button style={btnPrimary} onClick={submit}><Plus size={14} />등록</button>
        </div>

        <div style={{ fontSize: 12, color: C.faint, fontWeight: 600, marginBottom: 8 }}>{monthLabel} 입출고 내역</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {monthMovements.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>해당 월의 입출고 내역이 없습니다.</div>}
          {monthMovements.slice(0, 20).map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "1px solid #F5F6F3" }}>
              {m.type === "입고" ? <ArrowDownCircle size={15} color={C.primary} /> : <ArrowUpCircle size={15} color={C.amber} />}
              <span style={{ color: C.faint, fontFamily: MONO, fontSize: 11.5, width: 84 }}>{m.date}</span>
              <span style={{ fontWeight: 600, flex: 1 }}>{m.item}</span>
              <span style={{ fontFamily: MONO }}>{m.type === "입고" ? "+" : "-"}{m.qty.toLocaleString()}</span>
              <span style={{ color: C.faint, width: 140, textAlign: "right" }}>{m.partner}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- 회계 탭 (결산용) --------------------------------- */
function withSalesBalance(sales, deposits) {
  return sales.map(s => {
    const paid = deposits.filter(d => d.saleNo === s.no).reduce((a, d) => a + d.amount, 0);
    return { ...s, paid, balance: s.total - paid };
  });
}
function withPurchaseBalance(purchases, withdrawals) {
  return purchases.map(p => {
    const paid = withdrawals.filter(w => w.purchaseNo === p.no).reduce((a, w) => a + w.amount, 0);
    return { ...p, paid, balance: p.total - paid };
  });
}
function bankRunningBalance(bankOpening, bankTxns) {
  const sorted = [...bankTxns].sort((a, b) => a.date.localeCompare(b.date));
  let bal = bankOpening;
  return sorted.map(t => {
    bal += t.type === "입금" ? t.amount : -t.amount;
    return { ...t, balance: bal };
  });
}
function monthlyStats(sales, purchases, cards) {
  const map = {};
  const ensure = (mk) => { if (!map[mk]) map[mk] = { month: mk, sales: 0, purchases: 0, cards: 0 }; return map[mk]; };
  sales.forEach(s => { ensure(monthKey(s.date)).sales += s.total; });
  purchases.forEach(p => { ensure(monthKey(p.date)).purchases += p.total; });
  cards.forEach(c => { ensure(monthKey(c.date)).cards += c.amount; });
  return Object.values(map).sort((a, b) => a.month.localeCompare(b.month))
    .map(m => ({ ...m, profit: m.sales - m.purchases - m.cards }));
}

function MedalBadge({ rank }) {
  const colors = { 1: "#F5A623", 2: "#9AA5B1", 3: "#C08552" };
  const bg = colors[rank] || "#B9C2D0";
  return (
    <span style={{
      width: 20, height: 20, borderRadius: "50%", background: bg, color: "#fff",
      fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>{rank}</span>
  );
}

function RankTable({ rows, valueColor }) {
  if (!rows.length) return <div style={{ fontSize: 12, color: C.faint }}>데이터가 없습니다.</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((r, i) => (
        <div key={r.partner} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid #F1F3F7" }}>
          <MedalBadge rank={i + 1} />
          <span style={{ flex: 1, fontSize: 12.5, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.partner}</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, color: valueColor }}>{won(r.balance)}</span>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- 회계 · 매출 관리대장 --------------------------------- */
function SalesLedger({ sales, setSales, deposits }) {
  const [form, setForm] = useState({ date: today(), partner: "", item: "", supply: "", memo: "" });
  const fileRef = useRef(null);
  const rows = withSalesBalance(sales, deposits).sort((a, b) => b.date.localeCompare(a.date));
  const totals = rows.reduce((s, r) => ({
    supply: s.supply + r.supply, vat: s.vat + r.vat, total: s.total + r.total, paid: s.paid + r.paid, balance: s.balance + r.balance,
  }), { supply: 0, vat: 0, total: 0, paid: 0, balance: 0 });

  const add = () => {
    if (!form.partner || !form.supply) return;
    const supply = Number(form.supply);
    const vat = Math.round(supply * 0.1);
    const no = sales.length ? Math.max(...sales.map(s => s.no)) + 1 : 1;
    setSales(s => [...s, { id: uid(), no, date: form.date, partner: form.partner, item: form.item, supply, vat, total: supply + vat, memo: form.memo }]);
    setForm(f => ({ ...f, partner: "", item: "", supply: "", memo: "" }));
  };
  const remove = (id) => setSales(s => s.filter(x => x.id !== id));

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        let nextNo = sales.length ? Math.max(...sales.map(s => s.no)) : 0;
        const rows2 = res.data.filter(r => r["거래처"]).map(r => {
          nextNo += 1;
          const supply = Number(r["공급가액"] || 0);
          const vat = r["부가세"] !== undefined && r["부가세"] !== "" ? Number(r["부가세"]) : Math.round(supply * 0.1);
          return { id: uid(), no: nextNo, date: r["날짜"] || today(), partner: r["거래처"], item: r["품목"] || "", supply, vat, total: supply + vat, memo: r["비고"] || "" };
        });
        if (rows2.length) setSales(s => [...s, ...rows2]);
      },
    });
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>매출 등록</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleUpload} />
            <button style={btnGhost} onClick={() => fileRef.current.click()}><Upload size={13} />CSV 업로드</button>
            <button style={btnGhost} onClick={() => downloadCSV(rows.map(r => ({ 번호: r.no, 날짜: r.date, 거래처: r.partner, 품목: r.item, 공급가액: r.supply, 부가세: r.vat, 합계금액: r.total, 입금액: r.paid, 미수금액: r.balance, 비고: r.memo })), `매출관리대장_${today()}.csv`)}><Download size={13} />CSV 다운로드</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <input placeholder="거래처" value={form.partner} onChange={e => setForm(f => ({ ...f, partner: e.target.value }))} style={{ ...inputStyle, minWidth: 130 }} />
          <input placeholder="품목" value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} style={{ ...inputStyle, minWidth: 150 }} />
          <input placeholder="공급가액" type="number" value={form.supply} onChange={e => setForm(f => ({ ...f, supply: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="비고" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} style={{ ...inputStyle, minWidth: 100 }} />
          <button style={btnPrimary} onClick={add}><Plus size={14} />등록</button>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>매출 관리대장</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 940 }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 84px 110px 1fr 100px 90px 100px 100px 100px 32px", gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
              <span>번호</span><span>날짜</span><span>거래처</span><span>품목</span>
              <span style={{ textAlign: "right" }}>공급가액</span><span style={{ textAlign: "right" }}>부가세</span>
              <span style={{ textAlign: "right" }}>합계금액</span><span style={{ textAlign: "right", color: C.teal }}>입금액</span>
              <span style={{ textAlign: "right", color: C.pink }}>미수금액</span><span />
            </div>
            {rows.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "48px 84px 110px 1fr 100px 90px 100px 100px 100px 32px", gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ fontFamily: MONO, color: C.faint }}>{r.no}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{r.date}</span>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.partner}</span>
                <span style={{ color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item}</span>
                <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(r.supply)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.faint }}>{won(r.vat)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", fontWeight: 700 }}>{won(r.total)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.teal }}>{won(r.paid)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: r.balance > 0 ? C.pink : C.faint, fontWeight: 700 }}>{won(r.balance)}</span>
                <IconBtn danger onClick={() => remove(r.id)}><Trash2 size={13} /></IconBtn>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "48px 84px 110px 1fr 100px 90px 100px 100px 100px 32px", gap: 8, fontSize: 12.5, padding: "10px 0 0", fontWeight: 800, borderTop: `2px solid ${C.border}`, marginTop: 6 }}>
              <span /><span /><span /><span>합계</span>
              <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(totals.supply)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(totals.vat)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(totals.total)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right", color: C.teal }}>{won(totals.paid)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right", color: C.pink }}>{won(totals.balance)}</span>
              <span />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- 회계 · 매입 관리대장 --------------------------------- */
function PurchaseLedger({ purchases, setPurchases, withdrawals }) {
  const [form, setForm] = useState({ date: today(), partner: "", item: "", supply: "", memo: "" });
  const fileRef = useRef(null);
  const rows = withPurchaseBalance(purchases, withdrawals).sort((a, b) => b.date.localeCompare(a.date));
  const totals = rows.reduce((s, r) => ({
    supply: s.supply + r.supply, vat: s.vat + r.vat, total: s.total + r.total, paid: s.paid + r.paid, balance: s.balance + r.balance,
  }), { supply: 0, vat: 0, total: 0, paid: 0, balance: 0 });

  const add = () => {
    if (!form.partner || !form.supply) return;
    const supply = Number(form.supply);
    const vat = Math.round(supply * 0.1);
    const no = purchases.length ? Math.max(...purchases.map(p => p.no)) + 1 : 1;
    setPurchases(p => [...p, { id: uid(), no, date: form.date, partner: form.partner, item: form.item, supply, vat, total: supply + vat, memo: form.memo }]);
    setForm(f => ({ ...f, partner: "", item: "", supply: "", memo: "" }));
  };
  const remove = (id) => setPurchases(p => p.filter(x => x.id !== id));

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        let nextNo = purchases.length ? Math.max(...purchases.map(p => p.no)) : 0;
        const rows2 = res.data.filter(r => r["거래처"]).map(r => {
          nextNo += 1;
          const supply = Number(r["공급가액"] || 0);
          const vat = r["부가세"] !== undefined && r["부가세"] !== "" ? Number(r["부가세"]) : Math.round(supply * 0.1);
          return { id: uid(), no: nextNo, date: r["날짜"] || today(), partner: r["거래처"], item: r["품목"] || "", supply, vat, total: supply + vat, memo: r["비고"] || "" };
        });
        if (rows2.length) setPurchases(p => [...p, ...rows2]);
      },
    });
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>매입 등록</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleUpload} />
            <button style={btnGhost} onClick={() => fileRef.current.click()}><Upload size={13} />CSV 업로드</button>
            <button style={btnGhost} onClick={() => downloadCSV(rows.map(r => ({ 번호: r.no, 날짜: r.date, 거래처: r.partner, 품목: r.item, 공급가액: r.supply, 부가세: r.vat, 합계금액: r.total, 지급액: r.paid, 미지급금액: r.balance, 비고: r.memo })), `매입관리대장_${today()}.csv`)}><Download size={13} />CSV 다운로드</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <input placeholder="거래처" value={form.partner} onChange={e => setForm(f => ({ ...f, partner: e.target.value }))} style={{ ...inputStyle, minWidth: 130 }} />
          <input placeholder="품목" value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))} style={{ ...inputStyle, minWidth: 150 }} />
          <input placeholder="공급가액" type="number" value={form.supply} onChange={e => setForm(f => ({ ...f, supply: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="비고" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} style={{ ...inputStyle, minWidth: 100 }} />
          <button style={btnPrimary} onClick={add}><Plus size={14} />등록</button>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>매입 관리대장</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 940 }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 84px 110px 1fr 100px 90px 100px 100px 100px 32px", gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
              <span>번호</span><span>날짜</span><span>거래처</span><span>품목</span>
              <span style={{ textAlign: "right" }}>공급가액</span><span style={{ textAlign: "right" }}>부가세</span>
              <span style={{ textAlign: "right" }}>합계금액</span><span style={{ textAlign: "right", color: C.amber }}>지급액</span>
              <span style={{ textAlign: "right", color: C.red }}>미지급금액</span><span />
            </div>
            {rows.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "48px 84px 110px 1fr 100px 90px 100px 100px 100px 32px", gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ fontFamily: MONO, color: C.faint }}>{r.no}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{r.date}</span>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.partner}</span>
                <span style={{ color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.item}</span>
                <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(r.supply)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.faint }}>{won(r.vat)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", fontWeight: 700 }}>{won(r.total)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.amber }}>{won(r.paid)}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: r.balance > 0 ? C.red : C.faint, fontWeight: 700 }}>{won(r.balance)}</span>
                <IconBtn danger onClick={() => remove(r.id)}><Trash2 size={13} /></IconBtn>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "48px 84px 110px 1fr 100px 90px 100px 100px 100px 32px", gap: 8, fontSize: 12.5, padding: "10px 0 0", fontWeight: 800, borderTop: `2px solid ${C.border}`, marginTop: 6 }}>
              <span /><span /><span /><span>합계</span>
              <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(totals.supply)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(totals.vat)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(totals.total)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right", color: C.amber }}>{won(totals.paid)}</span>
              <span style={{ fontFamily: MONO, textAlign: "right", color: C.red }}>{won(totals.balance)}</span>
              <span />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- 회계 · 입금·출금 --------------------------------- */
function CashflowLedger({ sales, purchases, deposits, setDeposits, withdrawals, setWithdrawals }) {
  const openSales = withSalesBalance(sales, deposits).filter(s => s.balance > 0).sort((a, b) => b.date.localeCompare(a.date));
  const openPurchases = withPurchaseBalance(purchases, withdrawals).filter(p => p.balance > 0).sort((a, b) => b.date.localeCompare(a.date));

  const [depForm, setDepForm] = useState({ date: today(), saleNo: "", partner: "", amount: "", bank: "국민은행-법인", memo: "" });
  const [wdForm, setWdForm] = useState({ date: today(), purchaseNo: "", partner: "", amount: "", bank: "국민은행-법인", memo: "" });

  const pickSale = (no) => {
    const s = openSales.find(x => x.no === Number(no));
    setDepForm(f => ({ ...f, saleNo: no, partner: s ? s.partner : f.partner, amount: s ? String(s.balance) : f.amount }));
  };
  const pickPurchase = (no) => {
    const p = openPurchases.find(x => x.no === Number(no));
    setWdForm(f => ({ ...f, purchaseNo: no, partner: p ? p.partner : f.partner, amount: p ? String(p.balance) : f.amount }));
  };

  const addDeposit = () => {
    if (!depForm.partner || !depForm.amount) return;
    const no = deposits.length ? Math.max(...deposits.map(d => d.no)) + 1 : 1;
    setDeposits(d => [...d, { id: uid(), no, date: depForm.date, partner: depForm.partner, saleNo: depForm.saleNo ? Number(depForm.saleNo) : null, amount: Number(depForm.amount), bank: depForm.bank, category: "매출수금", memo: depForm.memo }]);
    setDepForm(f => ({ ...f, saleNo: "", partner: "", amount: "", memo: "" }));
  };
  const addWithdrawal = () => {
    if (!wdForm.partner || !wdForm.amount) return;
    const no = withdrawals.length ? Math.max(...withdrawals.map(w => w.no)) + 1 : 1;
    setWithdrawals(w => [...w, { id: uid(), no, date: wdForm.date, partner: wdForm.partner, purchaseNo: wdForm.purchaseNo ? Number(wdForm.purchaseNo) : null, amount: Number(wdForm.amount), bank: wdForm.bank, category: "매입지급", memo: wdForm.memo }]);
    setWdForm(f => ({ ...f, purchaseNo: "", partner: "", amount: "", memo: "" }));
  };
  const removeDeposit = (id) => setDeposits(d => d.filter(x => x.id !== id));
  const removeWithdrawal = (id) => setWithdrawals(w => w.filter(x => x.id !== id));

  const depRows = [...deposits].sort((a, b) => b.date.localeCompare(a.date));
  const wdRows = [...withdrawals].sort((a, b) => b.date.localeCompare(a.date));
  const ROWGRID = "84px 110px 60px 110px 130px 1fr 32px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginBottom: 12 }}>입금 등록 (매출 회수)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <input type="date" value={depForm.date} onChange={e => setDepForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <select value={depForm.saleNo} onChange={e => pickSale(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
            <option value="">관련 매출 선택(선택)</option>
            {openSales.map(s => (<option key={s.id} value={s.no}>#{s.no} {s.partner} · 잔액 {won(s.balance)}</option>))}
          </select>
          <input placeholder="거래처" value={depForm.partner} onChange={e => setDepForm(f => ({ ...f, partner: e.target.value }))} style={{ ...inputStyle, minWidth: 110 }} />
          <input placeholder="입금액" type="number" value={depForm.amount} onChange={e => setDepForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
          <input placeholder="입금통장" value={depForm.bank} onChange={e => setDepForm(f => ({ ...f, bank: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="비고" value={depForm.memo} onChange={e => setDepForm(f => ({ ...f, memo: e.target.value }))} style={{ ...inputStyle, minWidth: 100 }} />
          <button style={{ ...btnPrimary, background: C.teal }} onClick={addDeposit}><Plus size={14} />입금 등록</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 820 }}>
            <div style={{ display: "grid", gridTemplateColumns: ROWGRID, gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
              <span>날짜</span><span>거래처</span><span>매출#</span><span style={{ textAlign: "right" }}>입금액</span><span>입금통장</span><span>비고</span><span />
            </div>
            {depRows.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: ROWGRID, gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{r.date}</span>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.partner}</span>
                <span style={{ color: C.faint, fontFamily: MONO }}>{r.saleNo ? "#" + r.saleNo : "-"}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.teal, fontWeight: 700 }}>{won(r.amount)}</span>
                <span style={{ color: C.sub, fontSize: 11.5 }}>{r.bank}</span>
                <span style={{ color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.memo}</span>
                <IconBtn danger onClick={() => removeDeposit(r.id)}><Trash2 size={13} /></IconBtn>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.pink, marginBottom: 12 }}>출금 등록 (매입 지급)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <input type="date" value={wdForm.date} onChange={e => setWdForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <select value={wdForm.purchaseNo} onChange={e => pickPurchase(e.target.value)} style={{ ...inputStyle, minWidth: 220 }}>
            <option value="">관련 매입 선택(선택)</option>
            {openPurchases.map(p => (<option key={p.id} value={p.no}>#{p.no} {p.partner} · 잔액 {won(p.balance)}</option>))}
          </select>
          <input placeholder="거래처" value={wdForm.partner} onChange={e => setWdForm(f => ({ ...f, partner: e.target.value }))} style={{ ...inputStyle, minWidth: 110 }} />
          <input placeholder="출금액" type="number" value={wdForm.amount} onChange={e => setWdForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
          <input placeholder="출금통장" value={wdForm.bank} onChange={e => setWdForm(f => ({ ...f, bank: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="비고" value={wdForm.memo} onChange={e => setWdForm(f => ({ ...f, memo: e.target.value }))} style={{ ...inputStyle, minWidth: 100 }} />
          <button style={{ ...btnPrimary, background: C.pink }} onClick={addWithdrawal}><Plus size={14} />출금 등록</button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 820 }}>
            <div style={{ display: "grid", gridTemplateColumns: ROWGRID, gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
              <span>날짜</span><span>거래처</span><span>매입#</span><span style={{ textAlign: "right" }}>출금액</span><span>출금통장</span><span>비고</span><span />
            </div>
            {wdRows.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: ROWGRID, gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{r.date}</span>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.partner}</span>
                <span style={{ color: C.faint, fontFamily: MONO }}>{r.purchaseNo ? "#" + r.purchaseNo : "-"}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.pink, fontWeight: 700 }}>{won(r.amount)}</span>
                <span style={{ color: C.sub, fontSize: 11.5 }}>{r.bank}</span>
                <span style={{ color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.memo}</span>
                <IconBtn danger onClick={() => removeWithdrawal(r.id)}><Trash2 size={13} /></IconBtn>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- 회계 · 법인카드 사용대장 --------------------------------- */
function CardLedger({ cards, setCards }) {
  const [form, setForm] = useState({ date: today(), merchant: "", amount: "", card: "국민 법인카드", purpose: "", memo: "" });
  const fileRef = useRef(null);
  const rows = [...cards].sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const add = () => {
    if (!form.merchant || !form.amount) return;
    const no = cards.length ? Math.max(...cards.map(c => c.no)) + 1 : 1;
    setCards(c => [...c, { id: uid(), no, date: form.date, merchant: form.merchant, amount: Number(form.amount), card: form.card, purpose: form.purpose, memo: form.memo }]);
    setForm(f => ({ ...f, merchant: "", amount: "", purpose: "", memo: "" }));
  };
  const remove = (id) => setCards(c => c.filter(x => x.id !== id));

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        let nextNo = cards.length ? Math.max(...cards.map(c => c.no)) : 0;
        const newRows = res.data.filter(r => r["가맹점"]).map(r => {
          nextNo += 1;
          return { id: uid(), no: nextNo, date: r["날짜"] || today(), merchant: r["가맹점"], amount: Number(r["사용금액"] || 0), card: r["카드"] || "", purpose: r["사용목적"] || "", memo: r["비고"] || "" };
        });
        if (newRows.length) setCards(c => [...c, ...newRows]);
      },
    });
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>법인카드 사용 등록</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleUpload} />
            <button style={btnGhost} onClick={() => fileRef.current.click()}><Upload size={13} />CSV 업로드</button>
            <button style={btnGhost} onClick={() => downloadCSV(rows.map(r => ({ 번호: r.no, 날짜: r.date, 가맹점: r.merchant, 사용금액: r.amount, 카드: r.card, 사용목적: r.purpose, 비고: r.memo })), `법인카드사용대장_${today()}.csv`)}><Download size={13} />CSV 다운로드</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <input placeholder="가맹점" value={form.merchant} onChange={e => setForm(f => ({ ...f, merchant: e.target.value }))} style={{ ...inputStyle, minWidth: 140 }} />
          <input placeholder="사용금액" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
          <input placeholder="카드" value={form.card} onChange={e => setForm(f => ({ ...f, card: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="사용목적" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} style={{ ...inputStyle, minWidth: 130 }} />
          <input placeholder="비고" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} style={{ ...inputStyle, minWidth: 100 }} />
          <button style={btnPrimary} onClick={add}><Plus size={14} />등록</button>
        </div>
      </Card>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>법인카드 사용대장</div>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: C.pink }}>합계 {won(total)}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 84px 1fr 110px 100px 1fr 1fr 32px", gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
              <span>번호</span><span>날짜</span><span>가맹점</span><span style={{ textAlign: "right" }}>사용금액</span><span>카드</span><span>사용목적</span><span>비고</span><span />
            </div>
            {rows.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "48px 84px 1fr 110px 100px 1fr 1fr 32px", gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ fontFamily: MONO, color: C.faint }}>{r.no}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{r.date}</span>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.merchant}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.pink, fontWeight: 700 }}>{won(r.amount)}</span>
                <span style={{ color: C.sub, fontSize: 11.5 }}>{r.card}</span>
                <span style={{ color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.purpose}</span>
                <span style={{ color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.memo}</span>
                <IconBtn danger onClick={() => remove(r.id)}><Trash2 size={13} /></IconBtn>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- 회계 · 미수금·미지급금 현황 --------------------------------- */
function BalanceView({ sales, deposits, purchases, withdrawals }) {
  const salesBal = withSalesBalance(sales, deposits);
  const recvMap = {};
  salesBal.forEach(r => { if (!recvMap[r.partner]) recvMap[r.partner] = { partner: r.partner, total: 0, paid: 0 }; recvMap[r.partner].total += r.total; recvMap[r.partner].paid += r.paid; });
  const recvRows = Object.values(recvMap).map(x => ({ ...x, balance: x.total - x.paid })).sort((a, b) => b.balance - a.balance);

  const purchaseBal = withPurchaseBalance(purchases, withdrawals);
  const payMap = {};
  purchaseBal.forEach(r => { if (!payMap[r.partner]) payMap[r.partner] = { partner: r.partner, total: 0, paid: 0 }; payMap[r.partner].total += r.total; payMap[r.partner].paid += r.paid; });
  const payRows = Object.values(payMap).map(x => ({ ...x, balance: x.total - x.paid })).sort((a, b) => b.balance - a.balance);

  const Table = ({ title, rows, totalLabel, paidLabel, balanceLabel, color }) => {
    const filtered = rows.filter(r => r.balance !== 0);
    return (
      <Card style={{ flex: 1, minWidth: 360 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{title}</div>
        <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 110px 110px 110px", gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
          <span /><span>거래처</span><span style={{ textAlign: "right" }}>{totalLabel}</span><span style={{ textAlign: "right" }}>{paidLabel}</span><span style={{ textAlign: "right" }}>{balanceLabel}</span>
        </div>
        {filtered.map((r, i) => (
          <div key={r.partner} style={{ display: "grid", gridTemplateColumns: "30px 1fr 110px 110px 110px", gap: 8, alignItems: "center", fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid #F5F6F3" }}>
            <MedalBadge rank={i + 1} />
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.partner}</span>
            <span style={{ fontFamily: MONO, textAlign: "right" }}>{won(r.total)}</span>
            <span style={{ fontFamily: MONO, textAlign: "right", color: C.faint }}>{won(r.paid)}</span>
            <span style={{ fontFamily: MONO, textAlign: "right", fontWeight: 800, color }}>{won(r.balance)}</span>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ fontSize: 12, color: C.faint, padding: "10px 0" }}>잔액이 없습니다.</div>}
      </Card>
    );
  };

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      <Table title="미수금 현황 (매출거래처)" rows={recvRows} totalLabel="매출총액" paidLabel="입금총액" balanceLabel="미수금잔액" color={C.pink} />
      <Table title="미지급금 현황 (매입거래처)" rows={payRows} totalLabel="매입총액" paidLabel="지급총액" balanceLabel="미지급금잔액" color={C.amber} />
    </div>
  );
}

/* --------------------------------- 회계 · 지출캘린더 --------------------------------- */
function ExpenseCalendar({ withdrawals, cards }) {
  const [cal, setCal] = useState(() => { const d = new Date(today()); return { y: d.getFullYear(), m: d.getMonth() }; });
  const shiftMonth = (delta) => setCal(c => {
    const nm = c.m + delta;
    if (nm < 0) return { y: c.y - 1, m: 11 };
    if (nm > 11) return { y: c.y + 1, m: 0 };
    return { y: c.y, m: nm };
  });
  const monthLabel = `${cal.y}년 ${cal.m + 1}월`;
  const mk = `${cal.y}-${String(cal.m + 1).padStart(2, "0")}`;

  const items = [
    ...withdrawals.filter(w => monthKey(w.date) === mk).map(w => ({ date: w.date, type: "bank", desc: w.category || w.partner, amt: w.amount })),
    ...cards.filter(c => monthKey(c.date) === mk).map(c => ({ date: c.date, type: "card", desc: c.merchant, amt: c.amount })),
  ];
  const total = items.reduce((s, e) => s + e.amt, 0);
  const cardTotal = items.filter(e => e.type === "card").reduce((s, e) => s + e.amt, 0);
  const bankTotal = items.filter(e => e.type === "bank").reduce((s, e) => s + e.amt, 0);
  const daysWithSpend = new Set(items.map(e => e.date)).size || 1;
  const avg = Math.round(total / daysWithSpend);

  const byDay = {};
  items.forEach(e => { const d = Number(e.date.slice(8, 10)); (byDay[d] = byDay[d] || []).push(e); });

  const firstDow = new Date(cal.y, cal.m, 1).getDay();
  const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const WD = ["일", "월", "화", "수", "목", "금", "토"];

  const stat = (label, value, color) => (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <div style={{ fontSize: 11.5, color: C.faint, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 19, fontWeight: 800, fontFamily: MONO, color, marginTop: 5 }}>{won(value)}</div>
    </Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {stat("이번달 총 지출", total, C.ink)}
        {stat("법인카드 사용액", cardTotal, C.pink)}
        {stat("계좌 출금액", bankTotal, C.teal)}
        {stat("지출 발생일 평균", avg, C.blue)}
      </div>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IconBtn onClick={() => shiftMonth(-1)}><ChevronLeft size={16} /></IconBtn>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.ink }}>{monthLabel}</span>
            <IconBtn onClick={() => shiftMonth(1)}><ChevronRightIcon size={16} /></IconBtn>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.sub }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: C.teal, display: "inline-block" }} />계좌 출금</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: C.pink, display: "inline-block" }} />법인카드 사용</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 4 }}>
          {WD.map((w, i) => (<div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, padding: "4px 0", color: i === 0 ? C.red : i === 6 ? C.blue : C.faint }}>{w}</div>))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 6 }}>
            {week.map((d, di) => {
              if (!d) return <div key={di} />;
              const dateKey = `${mk}-${String(d).padStart(2, "0")}`;
              const dItems = (byDay[d] || []).slice().sort((a, b) => b.amt - a.amt);
              const dayTotal = dItems.reduce((s, e) => s + e.amt, 0);
              const shown = dItems.slice(0, 2);
              const rest = dItems.length - shown.length;
              const isToday = dateKey === today();
              return (
                <div key={di} style={{ minHeight: 92, borderRadius: 10, background: "#FAFBFD", border: isToday ? `1.6px solid ${C.teal}` : `1px solid ${C.border}`, padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: di === 0 ? C.red : di === 6 ? C.blue : "#4B5566" }}>{d}</span>
                  {dayTotal > 0 && <span style={{ fontSize: 11.5, fontWeight: 800, fontFamily: MONO, color: C.ink }}>-{won(dayTotal)}</span>}
                  {shown.map((e, i) => (
                    <div key={i} style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 6, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      background: e.type === "card" ? C.pinkSoft : C.tealSoft, color: e.type === "card" ? C.pink : C.teal,
                    }}>{e.desc}</div>
                  ))}
                  {rest > 0 && <span style={{ fontSize: 10, color: C.faint }}>외 {rest}건</span>}
                </div>
              );
            })}
          </div>
        ))}
      </Card>
    </div>
  );
}

/* --------------------------------- 회계 · 통장거래 내역 --------------------------------- */
function BankLedger({ bankTxns, setBankTxns, bankOpening, setBankOpening }) {
  const [form, setForm] = useState({ date: today(), type: "입금", desc: "", amount: "" });
  const rows = bankRunningBalance(bankOpening, bankTxns);
  const add = () => {
    if (!form.desc || !form.amount) return;
    setBankTxns(t => [...t, { id: uid(), date: form.date, type: form.type, desc: form.desc, amount: Number(form.amount) }]);
    setForm(f => ({ ...f, desc: "", amount: "" }));
  };
  const remove = (id) => setBankTxns(t => t.filter(x => x.id !== id));
  const latestBalance = rows.length ? rows[rows.length - 1].balance : bankOpening;
  const ROWGRID = "90px 55px 1fr 110px 110px 120px 32px";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>기초잔액</div>
            <input type="number" value={bankOpening} onChange={e => setBankOpening(Number(e.target.value))}
              style={{ ...inputStyle, width: 180, fontSize: 18, fontWeight: 800, fontFamily: MONO, color: C.teal, marginTop: 4 }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: C.faint, fontWeight: 600, textAlign: "right" }}>현재 통장잔액</div>
            <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: C.blue, marginTop: 4 }}>{won(latestBalance)}</div>
          </div>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>거래 등록</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
            <option value="입금">입금</option><option value="출금">출금</option>
          </select>
          <input placeholder="내용" value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
          <input placeholder="금액" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
          <button style={btnPrimary} onClick={add}><Plus size={14} />등록</button>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>통장거래 내역</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 780 }}>
            <div style={{ display: "grid", gridTemplateColumns: ROWGRID, gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
              <span>날짜</span><span>구분</span><span>내용</span><span style={{ textAlign: "right" }}>입금액</span><span style={{ textAlign: "right" }}>출금액</span><span style={{ textAlign: "right" }}>잔액</span><span />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: ROWGRID, gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3", color: C.faint, fontWeight: 700 }}>
              <span>-</span><span>기초</span><span>이월 잔액</span><span /><span /><span style={{ textAlign: "right", fontFamily: MONO }}>{won(bankOpening)}</span><span />
            </div>
            {rows.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: ROWGRID, gap: 8, alignItems: "center", fontSize: 12.5, padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{r.date}</span>
                <Badge tone={r.type === "입금" ? "teal" : "pink"}>{r.type}</Badge>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.teal }}>{r.type === "입금" ? won(r.amount) : ""}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", color: C.pink }}>{r.type === "출금" ? won(r.amount) : ""}</span>
                <span style={{ fontFamily: MONO, textAlign: "right", fontWeight: 700 }}>{won(r.balance)}</span>
                <IconBtn danger onClick={() => remove(r.id)}><Trash2 size={13} /></IconBtn>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- 회계 · 대시보드 --------------------------------- */
function AccDashboardSub({ sales, purchases, deposits, withdrawals, cards, bankTxns, bankOpening }) {
  const salesBal = withSalesBalance(sales, deposits);
  const purchaseBal = withPurchaseBalance(purchases, withdrawals);
  const bankRows = bankRunningBalance(bankOpening, bankTxns);
  const latestBalance = bankRows.length ? bankRows[bankRows.length - 1].balance : bankOpening;
  const stats = monthlyStats(sales, purchases, cards).slice(-3);
  const curMonth = monthKey(today());
  const cur = stats.find(m => m.month === curMonth) || stats[stats.length - 1] || { sales: 0, purchases: 0, cards: 0, profit: 0 };

  const receivableTotal = salesBal.reduce((s, r) => s + r.balance, 0);
  const salesTotalAll = salesBal.reduce((s, r) => s + r.total, 0);
  const paidTotalAll = salesBal.reduce((s, r) => s + r.paid, 0);
  const purchaseTotalAll = purchaseBal.reduce((s, r) => s + r.total, 0);
  const paidPurchaseTotalAll = purchaseBal.reduce((s, r) => s + r.paid, 0);
  const collectRate = salesTotalAll ? Math.round((paidTotalAll / salesTotalAll) * 100) : 0;
  const payRate = purchaseTotalAll ? Math.round((paidPurchaseTotalAll / purchaseTotalAll) * 100) : 0;

  const recvMap = {}; salesBal.forEach(r => { if (!recvMap[r.partner]) recvMap[r.partner] = { partner: r.partner, balance: 0 }; recvMap[r.partner].balance += r.balance; });
  const recvTop = Object.values(recvMap).filter(x => x.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5);
  const payMap = {}; purchaseBal.forEach(r => { if (!payMap[r.partner]) payMap[r.partner] = { partner: r.partner, balance: 0 }; payMap[r.partner].balance += r.balance; });
  const payTop = Object.values(payMap).filter(x => x.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5);

  const custMap = {}; salesBal.forEach(r => { custMap[r.partner] = (custMap[r.partner] || 0) + r.total; });
  const custTop = Object.entries(custMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  const merchMap = {}; cards.forEach(c => { merchMap[c.merchant] = (merchMap[c.merchant] || 0) + c.amount; });
  const merchTop = Object.entries(merchMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

  const kpi = (label, value, color) => (
    <div style={{ textAlign: "center", flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{manwon(value)}</div>
      <div style={{ fontSize: 11, color: C.faint, marginTop: 3, fontWeight: 600 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 280px", minWidth: 260 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>이번달 현황</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            {kpi("이번달 매출", cur.sales, C.teal)}
            {kpi("미수금 총액", receivableTotal, C.pink)}
            {kpi("통장 잔액", latestBalance, C.blue)}
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 11, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475269", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>누적 입금 완료율</span><span style={{ color: C.teal, fontWeight: 800 }}>{collectRate}%</span>
            </div>
            <div style={{ background: "#E4E9F1", borderRadius: 20, height: 20, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(collectRate, 100)}%`, height: "100%", background: C.teal, display: "flex", alignItems: "center", paddingLeft: 8, color: "#fff", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                {manwon(paidTotalAll)} / {manwon(salesTotalAll)}
              </div>
            </div>
          </div>
          <div style={{ background: "#F8FAFC", borderRadius: 11, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475269", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>누적 지급 완료율</span><span style={{ color: C.pink, fontWeight: 800 }}>{payRate}%</span>
            </div>
            <div style={{ background: "#E4E9F1", borderRadius: 20, height: 20, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(payRate, 100)}%`, height: "100%", background: C.pink, display: "flex", alignItems: "center", paddingLeft: 8, color: "#fff", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                {manwon(paidPurchaseTotalAll)} / {manwon(purchaseTotalAll)}
              </div>
            </div>
          </div>
        </Card>

        <Card style={{ flex: "2 1 320px", minWidth: 300 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>월별 매출 · 매입 현황</div>
          <ResponsiveContainer width="100%" height={222}>
            <BarChart data={stats.map(m => ({ ...m, label: m.month.slice(5) + "월" }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAEDE8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} tickFormatter={v => manwon(v)} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={v => won(v)} />
              <Bar dataKey="sales" name="매출액" fill={C.teal} radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" name="매입액" fill={C.pinkSoft} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card style={{ flex: "2 1 320px", minWidth: 300 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>통장잔액 추이</div>
          <ResponsiveContainer width="100%" height={222}>
            <LineChart data={bankRows.map(r => ({ label: r.date.slice(5), balance: r.balance }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EAEDE8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.sub }} axisLine={{ stroke: C.border }} tickLine={false} minTickGap={20} />
              <YAxis tick={{ fontSize: 11, fill: C.sub }} axisLine={false} tickLine={false} tickFormatter={v => manwon(v)} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={v => won(v)} />
              <Line type="monotone" dataKey="balance" stroke={C.blue} strokeWidth={2.4} dot={{ r: 2.5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>미수금 TOP 5</div>
          <RankTable rows={recvTop} valueColor={C.pink} />
        </Card>
        <Card style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>미지급금 TOP 5</div>
          <RankTable rows={payTop} valueColor={C.amber} />
        </Card>
        <Card style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>누적 매출 거래처 TOP 5</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={custTop} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.sub }} tickFormatter={v => manwon(v)} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10.5, fill: C.ink }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={v => won(v)} />
              <Bar dataKey="value" fill={C.teal} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>법인카드 사용처 TOP 5</div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={merchTop} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: C.sub }} tickFormatter={v => manwon(v)} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10.5, fill: C.ink }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={v => won(v)} />
              <Bar dataKey="value" fill={C.pink} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

/* --------------------------------- 회계 관리 (메인, 하위탭) --------------------------------- */
const ACC_TABS = [
  { key: "dashboard", label: "대시보드", icon: LayoutGrid },
  { key: "sales", label: "매출", icon: TrendingUp },
  { key: "purchases", label: "매입", icon: TrendingDown },
  { key: "cashflow", label: "입금·출금", icon: ArrowUpCircle },
  { key: "card", label: "법인카드", icon: CreditCard },
  { key: "balance", label: "미수금·미지급금", icon: Users },
  { key: "calendar", label: "지출캘린더", icon: CalendarDays },
  { key: "bank", label: "통장거래", icon: Landmark },
];

function Accounting({ sales, setSales, purchases, setPurchases, deposits, setDeposits, withdrawals, setWithdrawals, cards, setCards, bankTxns, setBankTxns, bankOpening, setBankOpening }) {
  const [sub, setSub] = useState("dashboard");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={Receipt} title="회계 관리" sub="매출 · 매입 · 입출금 · 법인카드 · 미수금 통합관리" />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {ACC_TABS.map(t => {
          const Icon = t.icon;
          const active = sub === t.key;
          return (
            <button key={t.key} onClick={() => setSub(t.key)} style={{
              display: "flex", alignItems: "center", gap: 6, border: active ? "none" : `1px solid ${C.border}`,
              background: active ? C.primary : "#fff", color: active ? "#fff" : C.sub,
              borderRadius: 9, padding: "8px 13px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            }}><Icon size={14} />{t.label}</button>
          );
        })}
      </div>

      {sub === "dashboard" && <AccDashboardSub sales={sales} purchases={purchases} deposits={deposits} withdrawals={withdrawals} cards={cards} bankTxns={bankTxns} bankOpening={bankOpening} />}
      {sub === "sales" && <SalesLedger sales={sales} setSales={setSales} deposits={deposits} />}
      {sub === "purchases" && <PurchaseLedger purchases={purchases} setPurchases={setPurchases} withdrawals={withdrawals} />}
      {sub === "cashflow" && <CashflowLedger sales={sales} purchases={purchases} deposits={deposits} setDeposits={setDeposits} withdrawals={withdrawals} setWithdrawals={setWithdrawals} />}
      {sub === "card" && <CardLedger cards={cards} setCards={setCards} />}
      {sub === "balance" && <BalanceView sales={sales} deposits={deposits} purchases={purchases} withdrawals={withdrawals} />}
      {sub === "calendar" && <ExpenseCalendar withdrawals={withdrawals} cards={cards} />}
      {sub === "bank" && <BankLedger bankTxns={bankTxns} setBankTxns={setBankTxns} bankOpening={bankOpening} setBankOpening={setBankOpening} />}
    </div>
  );
}

/* --------------------------------- 상세 편집 패널(공통) --------------------------------- */
function DetailPanel({ title, children, onCancel, onSave, onDelete }) {
  return (
    <Card style={{ borderColor: C.primary }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: C.ink }}>{title}</span>
        <div style={{ display: "flex", gap: 8 }}>
          {onDelete && <button style={{ ...btnGhost, color: C.red, borderColor: C.redSoft }} onClick={onDelete}><Trash2 size={13} />삭제</button>}
          <button style={btnGhost} onClick={onCancel}><X size={13} />닫기</button>
          <button style={btnPrimary} onClick={onSave}><Save size={13} />저장</button>
        </div>
      </div>
      {children}
    </Card>
  );
}

/* --------------------------------- TODO 탭 (칸반) --------------------------------- */
function TodoTab({ todos, setTodos }) {
  const emptyForm = { title: "", assignee: "", due: "", priority: "중", stage: "주문", status: "대기", memo: "" };
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  const add = () => {
    if (!form.title) return;
    setTodos(t => [{ id: uid(), createdAt: today(), doneAt: "", ...form }, ...t]);
    setForm(emptyForm);
  };
  const remove = (id) => { setTodos(t => t.filter(x => x.id !== id)); setSelectedId(null); setDraft(null); };
  const save = () => { setTodos(t => t.map(x => x.id === selectedId ? { ...draft } : x)); setSelectedId(null); setDraft(null); };
  const openCard = (t) => { setSelectedId(t.id); setDraft({ ...t }); };

  const moveTo = (id, status) => {
    setTodos(t => t.map(x => x.id === id
      ? { ...x, status, doneAt: status === "완료" ? (x.doneAt || today()) : (status === x.status ? x.doneAt : "") }
      : x));
  };

  const onDragStart = (id) => (e) => {
    setDragId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragEnd = () => { setDragId(null); setDragOverCol(null); };
  const onColDragOver = (status) => (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(status); };
  const onColDrop = (status) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) moveTo(id, status);
    setDragId(null); setDragOverCol(null);
  };

  const stageIdx = (stage) => Math.max(STAGES.indexOf(stage), 0);
  const stageColor = (stage) => STAGE_COLORS[stageIdx(stage)];
  const counts = STATUS_LIST.reduce((acc, s) => ({ ...acc, [s]: todos.filter(t => t.status === s).length }), {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={CheckSquare} title="TODO" sub="칸반보드 — 카드를 드래그해서 상태를 바꾸세요" />

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>새 할 일 추가</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="할 일" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
          <input placeholder="담당자" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} style={{ ...inputStyle, width: 100 }} />
          <input type="date" value={form.due} onChange={e => setForm(f => ({ ...f, due: e.target.value }))} style={inputStyle} />
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
            <option>상</option><option>중</option><option>하</option>
          </select>
          <select value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))} style={inputStyle}>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
            {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button style={btnPrimary} onClick={add}><Plus size={14} />추가</button>
        </div>
      </Card>

      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
        {STATUS_LIST.map(status => {
          const style = STATUS_STYLE[status];
          const items = todos.filter(t => t.status === status);
          const isOver = dragOverCol === status;
          return (
            <div key={status}
              onDragOver={onColDragOver(status)}
              onDragLeave={() => setDragOverCol(c => c === status ? null : c)}
              onDrop={onColDrop(status)}
              style={{
                flex: "0 0 280px", minWidth: 280, background: "#EFF3F8", borderRadius: 18,
                border: isOver ? `2px dashed ${C.primary}` : "1px solid #E5EAF0", minHeight: 200,
                transition: "border 0.1s",
              }}>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 14px", fontWeight: 800, fontSize: 14.5, background: style.bg, color: style.fg,
                borderRadius: "18px 18px 0 0",
              }}>
                <span>{status}</span>
                <span style={{ fontFamily: MONO }}>{counts[status]}</span>
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12, minHeight: 160 }}>
                {items.length === 0 && (
                  <div style={{
                    padding: "20px 12px", border: "2px dashed #CBD5E1", borderRadius: 14,
                    textAlign: "center", color: C.faint, fontSize: 12, fontWeight: 700, background: "#fff",
                  }}>업무 없음</div>
                )}
                {items.map(t => {
                  const pb = PRIORITY_BADGE[t.priority] || PRIORITY_BADGE.중;
                  return (
                    <div key={t.id}
                      draggable
                      onDragStart={onDragStart(t.id)}
                      onDragEnd={onDragEnd}
                      onClick={() => openCard(t)}
                      style={{
                        background: "#fff", borderRadius: 14, padding: 13,
                        border: "1px solid #E5E7EB", boxShadow: "0 4px 12px rgba(15,23,42,.06)",
                        cursor: dragId === t.id ? "grabbing" : "grab", opacity: dragId === t.id ? 0.4 : 1,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
                        <span style={{ width: 9, height: 9, borderRadius: "50%", background: stageColor(t.stage), flexShrink: 0 }} />
                        <span style={{ fontWeight: 800, fontSize: 11.5, color: C.sub, marginRight: "auto" }}>{t.stage}</span>
                        <span style={{
                          fontSize: 10.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999,
                          background: pb.bg, color: pb.fg,
                        }}>{t.priority}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: C.ink, lineHeight: 1.4, marginBottom: 10 }}>{t.title}</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: t.memo ? 8 : 0 }}>
                        <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "6px 8px" }}>
                          <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 2 }}>담당자</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>{t.assignee || "-"}</div>
                        </div>
                        <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "6px 8px" }}>
                          <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 2 }}>마감</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>{t.due || "-"}</div>
                        </div>
                        <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "6px 8px" }}>
                          <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 2 }}>등록</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>{t.createdAt || "-"}</div>
                        </div>
                        <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "6px 8px" }}>
                          <div style={{ fontSize: 9.5, color: C.faint, marginBottom: 2 }}>완료</div>
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.ink }}>{t.doneAt || "-"}</div>
                        </div>
                      </div>
                      {t.memo && (
                        <div style={{ background: "#EFF6FF", color: "#1D4ED8", borderRadius: 10, padding: "8px 10px" }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800, marginBottom: 3 }}>메모</div>
                          <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>{t.memo}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {draft && (
        <DetailPanel
          title="할 일 상세/수정"
          onCancel={() => { setSelectedId(null); setDraft(null); }}
          onSave={save}
          onDelete={() => remove(selectedId)}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 200 }} placeholder="제목" />
            <input value={draft.assignee} onChange={e => setDraft(d => ({ ...d, assignee: e.target.value }))} style={{ ...inputStyle, width: 100 }} placeholder="담당자" />
            <input type="date" value={draft.due} onChange={e => setDraft(d => ({ ...d, due: e.target.value }))} style={inputStyle} />
            <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))} style={inputStyle}>
              <option>상</option><option>중</option><option>하</option>
            </select>
            <select value={draft.stage} onChange={e => setDraft(d => ({ ...d, stage: e.target.value }))} style={inputStyle}>
              {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value, doneAt: e.target.value === "완료" ? (d.doneAt || today()) : d.doneAt }))} style={inputStyle}>
              {STATUS_LIST.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, color: C.faint }}>등록일</div>
            <input type="date" value={draft.createdAt} onChange={e => setDraft(d => ({ ...d, createdAt: e.target.value }))} style={inputStyle} />
            <div style={{ fontSize: 11.5, color: C.faint }}>완료일</div>
            <input type="date" value={draft.doneAt} onChange={e => setDraft(d => ({ ...d, doneAt: e.target.value }))} style={inputStyle} />
          </div>
          <textarea value={draft.memo} onChange={e => setDraft(d => ({ ...d, memo: e.target.value }))}
            placeholder="메모" style={{ ...inputStyle, width: "100%", minHeight: 60, resize: "vertical", fontFamily: FONT }} />
        </DetailPanel>
      )}
    </div>
  );
}

/* ------------------------- 업무 체크리스트 탭 (마인드맵: 기간 → 부서 → 업무) ------------------------- */
function ChecklistTab({ checklist, setChecklist }) {
  const emptyForm = { date: "2026-08-10", period: "일일", dept: "회계", timeSlot: "", category: "", task: "", memo: "", priority: "중", assignee: "" };
  const [form, setForm] = useState(emptyForm);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const fileInputRef = useRef(null);

  const add = () => {
    if (!form.task) return;
    setChecklist(c => [{ id: uid(), done: false, ...form }, ...c]);
    setForm(f => ({ ...emptyForm, date: f.date, period: f.period, dept: f.dept }));
  };
  const remove = (id) => { setChecklist(c => c.filter(x => x.id !== id)); setSelectedId(null); setDraft(null); };
  const save = () => { setChecklist(c => c.map(x => x.id === selectedId ? { ...draft } : x)); };
  const selectLeaf = (node) => { setSelectedId(node.id); setDraft({ ...node.data }); };

  const downloadCSVFile = () => {
    const rows = checklist.map(c => ({
      완료: c.done ? "TRUE" : "FALSE", 날짜: c.date, 요일: dayKR(c.date), 기간: c.period, 부서: c.dept,
      시간대: c.timeSlot, 업무구분: c.category, 세부업무: c.task, "확인사항/메모": c.memo, 우선순위: c.priority, 담당자: c.assignee,
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `업무체크리스트_${today()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };
  const handleUploadClick = () => fileInputRef.current && fileInputRef.current.click();
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const newRows = res.data.map(r => ({
          id: uid(),
          date: r["날짜"] || today(),
          period: PERIODS.includes(r["기간"]) ? r["기간"] : "일일",
          dept: DEPTS.includes(r["부서"]) ? r["부서"] : "회계",
          timeSlot: r["시간대"] || "",
          category: r["업무구분"] || "",
          task: r["세부업무"] || "",
          done: String(r["완료"]).trim().toUpperCase() === "TRUE",
          memo: r["확인사항/메모"] || "",
          priority: ["상", "중", "하"].includes(r["우선순위"]) ? r["우선순위"] : "중",
          assignee: r["담당자"] || "",
        })).filter(r => r.task);
        if (newRows.length) setChecklist(list => [...newRows, ...list]);
      },
    });
    e.target.value = "";
  };

  const tree = {
    id: "root", label: "체크리스트", children: PERIODS.map(period => ({
      id: "p-" + period, label: period + "업무", color: PERIOD_COLORS[period],
      children: DEPTS.map(dept => ({
        id: "p-" + period + "-d-" + dept, label: dept, color: DEPT_COLORS[dept],
        children: checklist.filter(c => c.period === period && c.dept === dept)
          .map(c => ({ id: c.id, label: c.task || "(제목없음)", data: c })),
      })),
    })),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={ClipboardCheck} title="업무 체크리스트" sub="기간(일일·주간·월간) → 부서(회계·물류·인사) 마인드맵" />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>새 업무 추가</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
            <button style={btnGhost} onClick={handleUploadClick}><Upload size={13} />CSV 업로드</button>
            <button style={btnGhost} onClick={downloadCSVFile}><Download size={13} />CSV 다운로드</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} style={inputStyle}>
            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={form.dept} onChange={e => setForm(f => ({ ...f, dept: e.target.value }))} style={inputStyle}>
            {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
          <input placeholder="시간대(선택)" value={form.timeSlot} onChange={e => setForm(f => ({ ...f, timeSlot: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
          <input placeholder="업무구분" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
          <input placeholder="세부업무" value={form.task} onChange={e => setForm(f => ({ ...f, task: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
          <input placeholder="담당자" value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))} style={{ ...inputStyle, width: 100 }} />
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle}>
            <option>상</option><option>중</option><option>하</option>
          </select>
          <button style={btnPrimary} onClick={add}><Plus size={14} />추가</button>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
          {PERIODS.map(p => (
            <span key={p} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.sub }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: PERIOD_COLORS[p], display: "inline-block" }} />{p}업무
            </span>
          ))}
          {DEPTS.map(d => (
            <span key={d} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: C.sub }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: DEPT_COLORS[d], display: "inline-block" }} />{d}
            </span>
          ))}
          <span style={{ fontSize: 11, color: C.faint, marginLeft: "auto" }}>노드 클릭 시 상세/수정 · 보드는 드래그로 이동</span>
        </div>
        <MindMap tree={tree} width={1100} height={900} radiusStep={140} onLeafClick={selectLeaf} selectedId={selectedId} />
      </Card>

      {draft && (
        <DetailPanel
          title="업무 상세/수정"
          onCancel={() => { setSelectedId(null); setDraft(null); }}
          onSave={save}
          onDelete={() => remove(selectedId)}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <select value={draft.period} onChange={e => setDraft(d => ({ ...d, period: e.target.value }))} style={inputStyle}>
              {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={draft.dept} onChange={e => setDraft(d => ({ ...d, dept: e.target.value }))} style={inputStyle}>
              {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input type="date" value={draft.date} onChange={e => setDraft(d => ({ ...d, date: e.target.value }))} style={inputStyle} />
            <input value={draft.timeSlot} onChange={e => setDraft(d => ({ ...d, timeSlot: e.target.value }))} style={{ ...inputStyle, width: 100 }} placeholder="시간대" />
            <select value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value }))} style={inputStyle}>
              <option>상</option><option>중</option><option>하</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: C.sub }}>
              <input type="checkbox" checked={draft.done} onChange={e => setDraft(d => ({ ...d, done: e.target.checked }))} style={{ accentColor: C.primary }} />
              완료
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <input value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value }))} style={{ ...inputStyle, width: 130 }} placeholder="업무구분" />
            <input value={draft.task} onChange={e => setDraft(d => ({ ...d, task: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 200 }} placeholder="세부업무" />
            <input value={draft.assignee} onChange={e => setDraft(d => ({ ...d, assignee: e.target.value }))} style={{ ...inputStyle, width: 100 }} placeholder="담당자" />
          </div>
          <textarea value={draft.memo} onChange={e => setDraft(d => ({ ...d, memo: e.target.value }))}
            placeholder="확인사항/메모" style={{ ...inputStyle, width: "100%", minHeight: 60, resize: "vertical", fontFamily: FONT }} />
        </DetailPanel>
      )}
    </div>
  );
}

/* --------------------------------- 분기 목표관리 (OKR) --------------------------------- */
function OkrTab({ okrs, setOkrs }) {
  const [form, setForm] = useState({ title: "", owner: "", quarter: "2026 Q3" });

  const addObjective = () => {
    if (!form.title) return;
    setOkrs(o => [...o, { id: uid(), ...form, krs: [] }]);
    setForm({ title: "", owner: "", quarter: "2026 Q3" });
  };
  const addKr = (oid) => {
    const title = window.prompt("Key Result 내용을 입력하세요");
    if (!title) return;
    setOkrs(o => o.map(x => x.id === oid ? { ...x, krs: [...x.krs, { id: uid(), title, progress: 0 }] } : x));
  };
  const bump = (oid, kid, delta) => {
    setOkrs(o => o.map(x => x.id !== oid ? x : {
      ...x, krs: x.krs.map(k => k.id === kid ? { ...k, progress: Math.min(100, Math.max(0, k.progress + delta)) } : k)
    }));
  };
  const removeObjective = (oid) => setOkrs(o => o.filter(x => x.id !== oid));
  const removeKr = (oid, kid) => setOkrs(o => o.map(x => x.id !== oid ? x : { ...x, krs: x.krs.filter(k => k.id !== kid) }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={Target} title="분기 목표관리 (OKR)" sub="Objective & Key Results" />

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Objective 추가</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="목표(Objective)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
          <input placeholder="오너" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
          <input value={form.quarter} onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
          <button style={btnPrimary} onClick={addObjective}><Plus size={14} />추가</button>
        </div>
      </Card>

      {okrs.map(o => {
        const avg = o.krs.length ? Math.round(o.krs.reduce((s, k) => s + k.progress, 0) / o.krs.length) : 0;
        return (
          <Card key={o.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <Badge tone="primary">{o.quarter}</Badge>
                <div style={{ fontWeight: 800, fontSize: 15, color: C.ink, marginTop: 6 }}>{o.title}</div>
                <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>오너: {o.owner || "미지정"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: 20, color: C.primary }}>{avg}%</div>
                <IconBtn danger onClick={() => removeObjective(o.id)}><Trash2 size={14} /></IconBtn>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
              {o.krs.map(k => (
                <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: C.ink, flex: 1 }}>{k.title}</span>
                  <div style={{ width: 140, height: 8, background: "#EDEFEA", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${k.progress}%`, height: "100%", background: C.primary, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 12, width: 32, textAlign: "right", color: C.sub }}>{k.progress}%</span>
                  <IconBtn onClick={() => bump(o.id, k.id, -10)}><Minus size={13} /></IconBtn>
                  <IconBtn onClick={() => bump(o.id, k.id, 10)}><Plus size={13} /></IconBtn>
                  <IconBtn danger onClick={() => removeKr(o.id, k.id)}><Trash2 size={13} /></IconBtn>
                </div>
              ))}
              <button onClick={() => addKr(o.id)} style={{
                alignSelf: "flex-start", border: `1px dashed ${C.border}`, background: "transparent",
                color: C.faint, fontSize: 12, borderRadius: 8, padding: "6px 10px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4, marginTop: 2,
              }}><Plus size={12} /> Key Result 추가</button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* --------------------------------- 대표님 보고 --------------------------------- */
const STATUS_CYCLE = ["정상", "지연", "확인필요"];
const cycleStatus = (s) => STATUS_CYCLE[(STATUS_CYCLE.indexOf(s) + 1) % STATUS_CYCLE.length];
const statusTone = { 정상: "primary", 지연: "red", 확인필요: "amber" };

function buildReportText(r) {
  const heading = r.date === today()
    ? `오늘(${r.date} ${dayKR(r.date)}) 업무 보고드립니다.`
    : `${r.date}(${dayKR(r.date)}) 업무 보고드립니다.`;
  return [
    heading,
    `주문: ${r.orderStatus}`,
    `생산: ${r.prodStatus}`,
    `출고·배송: ${r.shipStatus}`,
    `매출: ${r.salesWon}만원`,
    `입금: ${r.collectedWon}만원`,
    `미수금: ${r.receivableWon}만원`,
    `발주: ${r.orderNeed || "없음"}`,
    `특이사항: ${r.note || "없음"}`,
    `대표님 결정사항: ${r.decision || "없음"}`,
  ].join("\n");
}

function ReportTab({ reports, setReports, todos, sales, deposits, inventory }) {
  const [date, setDate] = useState(today());
  const [draft, setDraft] = useState(null);
  const [copied, setCopied] = useState(false);

  const autoStageStatus = (stage) => {
    const items = todos.filter(t => t.stage === stage);
    if (!items.length) return "정상";
    return items.every(t => t.status === "완료") ? "정상" : "지연";
  };
  const salesTotal = sales.reduce((s, x) => s + x.total, 0);
  const collected = withSalesBalance(sales, deposits).reduce((s, x) => s + x.paid, 0);
  const receivable = salesTotal - collected;
  const lowStock = inventory.filter(i => i.qty < i.safety);
  const autoOrderNeed = lowStock.length ? `${lowStock.map(i => i.name).join(", ")} 발주 필요` : "없음";

  const existing = reports.find(r => r.date === date);

  useEffect(() => {
    if (existing) {
      setDraft({ ...existing });
    } else {
      setDraft({
        id: uid(), date,
        orderStatus: autoStageStatus("주문"), prodStatus: autoStageStatus("생산"), shipStatus: autoStageStatus("출고"),
        salesWon: Math.round(salesTotal / 10000), collectedWon: Math.round(collected / 10000), receivableWon: Math.round(receivable / 10000),
        orderNeed: autoOrderNeed, note: "없음", decision: "없음",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, reports.length]);

  if (!draft) return null;

  const save = () => {
    setReports(rs => {
      const others = rs.filter(r => r.date !== draft.date);
      return [...others, { ...draft, savedAt: new Date().toISOString() }].sort((a, b) => b.date.localeCompare(a.date));
    });
  };
  const removeReport = (id) => setReports(rs => rs.filter(r => r.id !== id));

  const reportText = buildReportText(draft);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  const downloadTxt = () => {
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `대표님보고_${draft.date}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const statusRow = (label, field) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: C.sub, width: 70 }}>{label}</span>
      <button onClick={() => setDraft(d => ({ ...d, [field]: cycleStatus(d[field]) }))}
        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
        <Badge tone={statusTone[draft[field]]}>{draft[field]}</Badge>
      </button>
      <span style={{ fontSize: 10.5, color: C.faint }}>(클릭해서 변경)</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={FileText} title="대표님 보고" sub="일일 업무 보고 자동 초안 + 이력 관리" />

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>보고 작성</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11.5, color: C.faint }}>보고일자</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
            {existing && <Badge tone="navy">저장됨</Badge>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {statusRow("주문", "orderStatus")}
          {statusRow("생산", "prodStatus")}
          {statusRow("출고·배송", "shipStatus")}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, marginBottom: 4 }}>매출(만원)</div>
            <input type="number" value={draft.salesWon} onChange={e => setDraft(d => ({ ...d, salesWon: Number(e.target.value) }))} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, marginBottom: 4 }}>입금(만원)</div>
            <input type="number" value={draft.collectedWon} onChange={e => setDraft(d => ({ ...d, collectedWon: Number(e.target.value) }))} style={{ ...inputStyle, width: "100%" }} />
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, marginBottom: 4 }}>미수금(만원)</div>
            <input type="number" value={draft.receivableWon} onChange={e => setDraft(d => ({ ...d, receivableWon: Number(e.target.value) }))} style={{ ...inputStyle, width: "100%" }} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, marginBottom: 4 }}>발주 (재고부족 품목 기준 자동입력, 수정 가능)</div>
          <input value={draft.orderNeed} onChange={e => setDraft(d => ({ ...d, orderNeed: e.target.value }))} style={{ ...inputStyle, width: "100%" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, marginBottom: 4 }}>특이사항</div>
          <textarea value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} style={{ ...inputStyle, width: "100%", minHeight: 50, resize: "vertical", fontFamily: FONT }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: C.faint, fontWeight: 600, marginBottom: 4 }}>대표님 결정사항</div>
          <textarea value={draft.decision} onChange={e => setDraft(d => ({ ...d, decision: e.target.value }))} style={{ ...inputStyle, width: "100%", minHeight: 50, resize: "vertical", fontFamily: FONT }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button style={btnPrimary} onClick={save}><Save size={14} />{existing ? "보고 업데이트" : "보고 저장"}</button>
        </div>
      </Card>

      <Card style={{ background: C.primaryDark }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#C9DBCE" }}>보고서 미리보기</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copyText} style={{ ...btnGhost, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "복사됨" : "복사하기"}
            </button>
            <button onClick={downloadTxt} style={{ ...btnGhost, background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)" }}>
              <Download size={13} />다운로드
            </button>
          </div>
        </div>
        <pre style={{
          whiteSpace: "pre-wrap", color: "#fff", fontFamily: MONO, fontSize: 13, lineHeight: 1.8,
          background: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 16, margin: 0,
        }}>{reportText}</pre>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>정재연 과장</div>
            <div style={{ color: "#9FB6A6", fontSize: 11.5 }}>운영관리팀</div>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>지난 보고 이력</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {reports.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>저장된 보고가 없습니다.</div>}
          {reports.map(r => (
            <div key={r.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
              border: `1px solid ${C.border}`, borderRadius: 10,
              background: r.date === date ? C.primarySoft : "transparent", cursor: "pointer",
            }} onClick={() => setDate(r.date)}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.ink, fontWeight: 700, width: 100 }}>{r.date} ({dayKRshort(r.date)})</span>
              <Badge tone={statusTone[r.orderStatus]}>주문 {r.orderStatus}</Badge>
              <Badge tone={statusTone[r.prodStatus]}>생산 {r.prodStatus}</Badge>
              <Badge tone={statusTone[r.shipStatus]}>출고 {r.shipStatus}</Badge>
              <span style={{ fontSize: 11.5, color: C.faint, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.note && r.note !== "없음" ? `특이사항: ${r.note}` : ""}
              </span>
              <IconBtn danger title="삭제" onClick={(e) => { e.stopPropagation(); removeReport(r.id); }}><Trash2 size={14} /></IconBtn>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* --------------------------------- 거래처마스터 (00번 시트) --------------------------------- */
const seedPartners = () => ([
  { id: uid(), name: "(주)한빛테크", type: "매출처", bizNo: "123-45-67890", ceo: "김한빛", bizType: "서비스업", bizItem: "IT컨설팅", addr: "서울 강남구", manager: "이선영", phone: "02-1234-5678", email: "contact@hanbit.co.kr", memo: "" },
  { id: uid(), name: "대성상사", type: "매출처", bizNo: "234-56-78901", ceo: "박대성", bizType: "도소매업", bizItem: "사무용가구", addr: "경기 부천시", manager: "정민호", phone: "032-234-5678", email: "sales@daesung.co.kr", memo: "" },
  { id: uid(), name: "그린푸드", type: "매출처", bizNo: "345-67-89012", ceo: "최그린", bizType: "제조업", bizItem: "식자재", addr: "경기 안산시", manager: "한지민", phone: "031-345-6789", email: "info@greenfood.co.kr", memo: "정기 납품" },
  { id: uid(), name: "서울물산", type: "매출처", bizNo: "456-78-90123", ceo: "윤서울", bizType: "도소매업", bizItem: "포장재", addr: "서울 금천구", manager: "강태영", phone: "02-456-7890", email: "biz@seoulmulsan.co.kr", memo: "" },
  { id: uid(), name: "미래건설", type: "매출처", bizNo: "567-89-01234", ceo: "오미래", bizType: "건설업", bizItem: "인테리어", addr: "인천 남동구", manager: "서지후", phone: "032-567-8901", email: "contact@miraecon.co.kr", memo: "" },
  { id: uid(), name: "대한자재", type: "매입처", bizNo: "678-90-12345", ceo: "임대한", bizType: "제조업", bizItem: "원자재", addr: "경기 시흥시", manager: "문상현", phone: "031-678-9012", email: "order@daehanmj.co.kr", memo: "" },
  { id: uid(), name: "한국물류", type: "매입처", bizNo: "789-01-23456", ceo: "송한국", bizType: "운송업", bizItem: "화물운송", addr: "경기 화성시", manager: "조은우", phone: "031-789-0123", email: "logi@hankuk.co.kr", memo: "" },
  { id: uid(), name: "삼진전자", type: "매입처", bizNo: "890-12-34567", ceo: "배삼진", bizType: "도소매업", bizItem: "사무기기", addr: "서울 구로구", manager: "유나영", phone: "02-890-1234", email: "sale@samjin.co.kr", memo: "" },
  { id: uid(), name: "우리문구", type: "매입처", bizNo: "901-23-45678", ceo: "장우리", bizType: "도소매업", bizItem: "사무용품", addr: "서울 영등포구", manager: "황보민", phone: "02-901-2345", email: "shop@woori-mg.co.kr", memo: "" },
  { id: uid(), name: "태양인쇄", type: "매입처", bizNo: "012-34-56789", ceo: "홍태양", bizType: "제조업", bizItem: "인쇄", addr: "경기 고양시", manager: "남궁윤", phone: "031-012-3456", email: "print@taeyang.co.kr", memo: "" },
]);

function PartnerMaster({ partners, setPartners }) {
  const emptyForm = { name: "", type: "매출처", bizNo: "", ceo: "", bizType: "", bizItem: "", addr: "", manager: "", phone: "", email: "", memo: "" };
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState("전체");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const fileRef = useRef(null);

  const add = () => {
    if (!form.name) return;
    setPartners(p => [{ id: uid(), ...form }, ...p]);
    setForm(emptyForm);
  };
  const remove = (id) => setPartners(p => p.filter(x => x.id !== id));
  const startEdit = (p) => { setEditingId(p.id); setEditDraft({ ...p }); };
  const saveEdit = () => { setPartners(p => p.map(x => x.id === editingId ? { ...editDraft } : x)); setEditingId(null); setEditDraft(null); };

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.filter(r => r["거래처명"]).map(r => ({
          id: uid(), name: r["거래처명"], type: r["구분"] || "매출처", bizNo: r["사업자번호"] || "",
          ceo: r["대표자"] || "", bizType: r["업태"] || "", bizItem: r["종목"] || "", addr: r["주소"] || "",
          manager: r["담당자"] || "", phone: r["연락처"] || "", email: r["이메일"] || "", memo: r["비고"] || "",
        }));
        if (rows.length) setPartners(p => [...rows, ...p]);
      },
    });
    e.target.value = "";
  };
  const download = () => downloadCSV(partners.map(p => ({
    거래처명: p.name, 구분: p.type, 사업자번호: p.bizNo, 대표자: p.ceo, 업태: p.bizType, 종목: p.bizItem,
    주소: p.addr, 담당자: p.manager, 연락처: p.phone, 이메일: p.email, 비고: p.memo,
  })), `거래처마스터_${today()}.csv`);

  const filtered = partners.filter(p => (filterType === "전체" || p.type === filterType) &&
    (!q || p.name.includes(q) || (p.manager || "").includes(q) || (p.bizItem || "").includes(q)));
  const salesCount = partners.filter(p => p.type === "매출처").length;
  const purchaseCount = partners.filter(p => p.type === "매입처").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle icon={Users} title="거래처마스터" sub="매출처 · 매입처 기본정보 통합관리 (00번 시트)" />

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>전체 거래처</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: C.ink, marginTop: 6 }}>{partners.length}개</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>매출처</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: C.teal, marginTop: 6 }}>{salesCount}개</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: C.faint, fontWeight: 600 }}>매입처</div>
          <div style={{ fontSize: 24, fontWeight: 800, fontFamily: MONO, color: C.pink, marginTop: 6 }}>{purchaseCount}개</div>
        </Card>
      </div>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>거래처 등록</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleUpload} />
            <button style={btnGhost} onClick={() => fileRef.current.click()}><Upload size={13} />CSV 업로드</button>
            <button style={btnGhost} onClick={download}><Download size={13} />CSV 다운로드</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="거래처명" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, minWidth: 140 }} />
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
            <option value="매출처">매출처</option><option value="매입처">매입처</option>
          </select>
          <input placeholder="사업자번호" value={form.bizNo} onChange={e => setForm(f => ({ ...f, bizNo: e.target.value }))} style={{ ...inputStyle, width: 130 }} />
          <input placeholder="대표자" value={form.ceo} onChange={e => setForm(f => ({ ...f, ceo: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
          <input placeholder="업태" value={form.bizType} onChange={e => setForm(f => ({ ...f, bizType: e.target.value }))} style={{ ...inputStyle, width: 100 }} />
          <input placeholder="종목" value={form.bizItem} onChange={e => setForm(f => ({ ...f, bizItem: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
          <input placeholder="주소" value={form.addr} onChange={e => setForm(f => ({ ...f, addr: e.target.value }))} style={{ ...inputStyle, minWidth: 140 }} />
          <input placeholder="담당자" value={form.manager} onChange={e => setForm(f => ({ ...f, manager: e.target.value }))} style={{ ...inputStyle, width: 90 }} />
          <input placeholder="연락처" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} style={{ ...inputStyle, width: 120 }} />
          <input placeholder="이메일" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={{ ...inputStyle, minWidth: 150 }} />
          <input placeholder="비고" value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} style={{ ...inputStyle, minWidth: 100 }} />
          <button style={btnPrimary} onClick={add}><Plus size={14} />등록</button>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>거래처 목록</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} style={inputStyle}>
              <option value="전체">전체</option><option value="매출처">매출처</option><option value="매입처">매입처</option>
            </select>
            <input placeholder="거래처명/담당자/종목 검색" value={q} onChange={e => setQ(e.target.value)} style={{ ...inputStyle, minWidth: 180 }} />
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1100 }}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 60px 110px 70px 90px 100px 1fr 80px 110px 150px 32px", gap: 8, fontSize: 10.5, color: C.faint, fontWeight: 700, padding: "0 0 6px" }}>
              <span>거래처명</span><span>구분</span><span>사업자번호</span><span>대표자</span><span>업태</span><span>종목</span><span>주소</span><span>담당자</span><span>연락처</span><span>이메일</span><span />
            </div>
            {filtered.map(p => (
              editingId === p.id ? (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "140px 60px 110px 70px 90px 100px 1fr 80px 110px 150px 32px", gap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid #F5F6F3" }}>
                  <input value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <select value={editDraft.type} onChange={e => setEditDraft(d => ({ ...d, type: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }}>
                    <option value="매출처">매출처</option><option value="매입처">매입처</option>
                  </select>
                  <input value={editDraft.bizNo} onChange={e => setEditDraft(d => ({ ...d, bizNo: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <input value={editDraft.ceo} onChange={e => setEditDraft(d => ({ ...d, ceo: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <input value={editDraft.bizType} onChange={e => setEditDraft(d => ({ ...d, bizType: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <input value={editDraft.bizItem} onChange={e => setEditDraft(d => ({ ...d, bizItem: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <input value={editDraft.addr} onChange={e => setEditDraft(d => ({ ...d, addr: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <input value={editDraft.manager} onChange={e => setEditDraft(d => ({ ...d, manager: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <input value={editDraft.phone} onChange={e => setEditDraft(d => ({ ...d, phone: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <input value={editDraft.email} onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))} style={{ ...inputStyle, padding: "4px 6px", fontSize: 11.5 }} />
                  <div style={{ display: "flex", gap: 2 }}>
                    <IconBtn title="저장" onClick={saveEdit}><Check size={13} color={C.primary} /></IconBtn>
                    <IconBtn title="취소" onClick={() => setEditingId(null)}><X size={13} /></IconBtn>
                  </div>
                </div>
              ) : (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "140px 60px 110px 70px 90px 100px 1fr 80px 110px 150px 32px", gap: 8, alignItems: "center", fontSize: 12.5, padding: "8px 0", borderBottom: "1px solid #F5F6F3" }}>
                  <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                  <Badge tone={p.type === "매출처" ? "teal" : "pink"}>{p.type}</Badge>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.faint }}>{p.bizNo}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.ceo}</span>
                  <span style={{ color: C.sub, fontSize: 11.5 }}>{p.bizType}</span>
                  <span style={{ color: C.sub, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.bizItem}</span>
                  <span style={{ color: C.faint, fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.addr}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.manager}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11 }}>{p.phone}</span>
                  <span style={{ color: C.faint, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    <IconBtn title="수정" onClick={() => startEdit(p)}><Pencil size={13} /></IconBtn>
                    <IconBtn danger title="삭제" onClick={() => remove(p.id)}><Trash2 size={13} /></IconBtn>
                  </div>
                </div>
              )
            ))}
            {filtered.length === 0 && <div style={{ fontSize: 12, color: C.faint, padding: "14px 0" }}>조건에 맞는 거래처가 없습니다.</div>}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ----------------------------------- App ----------------------------------- */
export default function App() {
  const [tab, setTab] = useState("dashboard");

  const [inventory, setInventory, r1] = useSyncedState("erp:inventory", seedInventory);
  const [movements, setMovements, r2] = useSyncedState("erp:movements", seedMovements);
  const [sales, setSales, r3] = useSyncedState("erp:sales", seedSales);
  const [purchases, setPurchases, r4] = useSyncedState("erp:purchases", seedPurchases);
  const [deposits, setDeposits, r5] = useSyncedState("erp:deposits", seedDeposits);
  const [withdrawals, setWithdrawals, r6] = useSyncedState("erp:withdrawals", seedWithdrawals);
  const [cards, setCards, r7] = useSyncedState("erp:cards", seedCards);
  const [bankTxns, setBankTxns, r8] = useSyncedState("erp:bankTxns", seedBankTxns);
  const [bankOpening, setBankOpening, r9] = useSyncedState("erp:bankOpening", seedBankOpening);
  const [todos, setTodos, r10] = useSyncedState("erp:todos2", seedTodos);
  const [checklist, setChecklist, r11] = useSyncedState("erp:checklist", seedChecklist);
  const [okrs, setOkrs, r12] = useSyncedState("erp:okrs", seedOkrs);
  const [reports, setReports, r13] = useSyncedState("erp:reports", seedReports);
  const [budget, setBudget, r14] = useSyncedState("erp:budget", seedBudget);
  const [ceoNotes, setCeoNotes, r15] = useSyncedState("erp:ceoNotes", seedCeoNotes);
  const [myNotes, setMyNotes, r16] = useSyncedState("erp:myNotes", seedMyNotes);
  const [partners, setPartners, r17] = useSyncedState("erp:partners", seedPartners);

  const loading = !(r1 && r2 && r3 && r4 && r5 && r6 && r7 && r8 && r9 && r10 && r11 && r12 && r13 && r14 && r15 && r16 && r17);

  const navItems = [
    { key: "dashboard", label: "대시보드", icon: LayoutDashboard },
    { key: "logistics", label: "물류", icon: Truck },
    { key: "accounting", label: "회계", icon: Receipt },
    { key: "partners", label: "거래처마스터", icon: Users },
    { key: "todo", label: "TODO", icon: CheckSquare },
    { key: "checklist", label: "업무체크리스트", icon: ClipboardCheck },
    { key: "okr", label: "분기목표(OKR)", icon: Target },
    { key: "report", label: "대표님 보고", icon: FileText },
  ];

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 500, fontFamily: FONT, color: C.faint }}>
        데이터를 불러오는 중...
      </div>
    );
  }

  return (
    <div style={{ display: "flex", fontFamily: FONT, background: C.bg, minHeight: 640, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.border}` }}>
      {/* 사이드바 */}
      <div style={{ width: 200, background: C.primaryDark, padding: "22px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 8px 14px" }}>
          <Package size={20} color="#fff" />
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>엘티에프포유 ERP</div>
            <div style={{ color: "#C9DBCE", fontSize: 11 }}>운영관리팀</div>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", marginBottom: 10,
          borderRadius: 8, background: "rgba(255,255,255,0.08)",
        }}>
          {SUPABASE_READY ? <Wifi size={13} color="#8FE3B0" /> : <WifiOff size={13} color="#F0C36B" />}
          <span style={{ fontSize: 10.5, color: SUPABASE_READY ? "#8FE3B0" : "#F0C36B", fontWeight: 700 }}>
            {SUPABASE_READY ? "팀 공유 데이터 연결됨" : "이 브라우저에만 저장 중"}
          </span>
        </div>
        {navItems.map(n => {
          const Icon = n.icon;
          const active = tab === n.key;
          return (
            <button key={n.key} onClick={() => setTab(n.key)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 10px",
              borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left",
              background: active ? "rgba(255,255,255,0.14)" : "transparent",
              color: active ? "#fff" : "#B9CCBE", fontWeight: active ? 700 : 500, fontSize: 13.5,
            }}>
              <Icon size={16} />{n.label}
            </button>
          );
        })}
        <div style={{ marginTop: "auto", padding: "12px 8px 0", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ color: "#fff", fontSize: 12.5, fontWeight: 700 }}>정재연 과장</div>
          <div style={{ color: "#9FB6A6", fontSize: 11 }}>운영관리팀</div>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, padding: 24, overflowY: "auto" }}>
        {tab === "dashboard" && <Dashboard withdrawals={withdrawals} cards={cards} deposits={deposits} budget={budget} setBudget={setBudget} ceoNotes={ceoNotes} setCeoNotes={setCeoNotes} myNotes={myNotes} setMyNotes={setMyNotes} />}
        {tab === "logistics" && <Logistics inventory={inventory} setInventory={setInventory} movements={movements} setMovements={setMovements} />}
        {tab === "accounting" && <Accounting sales={sales} setSales={setSales} purchases={purchases} setPurchases={setPurchases} deposits={deposits} setDeposits={setDeposits} withdrawals={withdrawals} setWithdrawals={setWithdrawals} cards={cards} setCards={setCards} bankTxns={bankTxns} setBankTxns={setBankTxns} bankOpening={bankOpening} setBankOpening={setBankOpening} />}
        {tab === "partners" && <PartnerMaster partners={partners} setPartners={setPartners} />}
        {tab === "todo" && <TodoTab todos={todos} setTodos={setTodos} />}
        {tab === "checklist" && <ChecklistTab checklist={checklist} setChecklist={setChecklist} />}
        {tab === "okr" && <OkrTab okrs={okrs} setOkrs={setOkrs} />}
        {tab === "report" && <ReportTab reports={reports} setReports={setReports} todos={todos} sales={sales} deposits={deposits} inventory={inventory} />}
      </div>
    </div>
  );
}

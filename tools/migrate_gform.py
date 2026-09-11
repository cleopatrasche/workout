"""구글 설문 TSV(2022-06-11 ~ 2026-09-04) -> Supabase 적재용 CSV 2개.

    python tools/migrate_gform.py archive/구글설문_220611-260904.tsv

출력:
    data/workout_logs.csv   운동 세션 (person_id, logged_on, exercise, ...)
    data/daily_notes.csv    하루 단위 (몸무게, 비고, 휴식 여부)
    data/migration_report.txt

의존성: pandas 만 사용. 결과 CSV는 Supabase Table Editor의 Import CSV로 그대로 올린다.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

# 과거 데이터는 전부 황의영(person_id=1) 기록이다.
PERSON_ID = 1

# 구글 설문 컬럼 -> 앱 운동 코드
COL_MAP = {
    "팔": "pushup",
    "배": "core",
    "허벅지": "leg",
}

# '기타' 컬럼은 비고 텍스트로 종목을 되살린다 (11건).
ETC_KEYWORDS = [
    (("배드민턴", "배민"), "badminton"),
    (("사이클", "자전거"), "cycling"),
]

# 소수 분(分) -> 초. 사용자가 쓰던 변환표의 구간 중앙값.
#   0.0 -> 00초(정각으로 간주)  0.1 -> 09초  0.2 -> 15초 ...  0.9 -> 57초
FRAC_TO_SEC = [0, 9, 15, 21, 27, 33, 39, 45, 51, 57]


def dec_min_to_sec(value) -> int | None:
    """47.6(분) -> 2859(초). 소수점이 없으면 정각으로 본다."""
    if pd.isna(value):
        return None
    minutes = int(value)
    frac = int(round((float(value) - minutes) * 10))
    if frac >= 10:  # 부동소수 반올림 방어
        minutes += 1
        frac = 0
    return minutes * 60 + FRAC_TO_SEC[frac]


def num(value):
    """빈 값은 None, 아니면 float."""
    if pd.isna(value):
        return None
    return float(value)


def etc_code(note: str | None) -> str:
    """'기타' 컬럼의 종목을 비고 텍스트로 추정한다. 못 찾으면 etc."""
    text = note or ""
    for keywords, code in ETC_KEYWORDS:
        if any(k in text for k in keywords):
            return code
    return "etc"


def main(tsv_path: str) -> None:
    src = Path(tsv_path)
    out_dir = src.parent.parent / "data"
    out_dir.mkdir(exist_ok=True)

    df = pd.read_csv(src, sep="\t", dtype=str)
    df["logged_on"] = pd.to_datetime(
        df["Date"].str.replace(" ", "", regex=False), format="%Y.%m.%d"
    ).dt.date

    for col in ["러닝 시간(분)", "러닝 거리(km)", "팔", "배", "허벅지",
                "수영 시간(분)", "수영(왕복)", "몸무게", "기타"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    sessions: list[dict] = []
    notes: dict[tuple, dict] = {}   # (person_id, logged_on) -> row
    rest_days = 0

    for _, r in df.iterrows():
        day = r["logged_on"]
        note = None if pd.isna(r["비고"]) else str(r["비고"]).strip()
        made_session = False

        def add(exercise, **kw):
            nonlocal made_session
            made_session = True
            sessions.append(
                {"person_id": PERSON_ID, "logged_on": day, "exercise": exercise,
                 "reps": None, "duration_sec": None, "distance_km": None,
                 "laps": None, "note": note, "source": "gform", **kw}
            )

        # 러닝: 시간 또는 거리 중 하나만 있어도 살린다
        if not pd.isna(r["러닝 시간(분)"]) or not pd.isna(r["러닝 거리(km)"]):
            add("run",
                duration_sec=dec_min_to_sec(r["러닝 시간(분)"]),
                distance_km=num(r["러닝 거리(km)"]))

        # 맨몸운동: 개수
        for col, code in COL_MAP.items():
            if not pd.isna(r[col]):
                add(code, reps=int(r[col]))

        # 수영: 과거 기록은 전부 자유형으로 본다
        if not pd.isna(r["수영 시간(분)"]) or not pd.isna(r["수영(왕복)"]):
            add("swim_free",
                duration_sec=dec_min_to_sec(r["수영 시간(분)"]),
                laps=num(r["수영(왕복)"]))

        # 기타: 비고로 종목 추정
        if not pd.isna(r["기타"]):
            add(etc_code(note), duration_sec=dec_min_to_sec(r["기타"]))

        # 하루 단위 정보 (몸무게 / 비고 / 휴식)
        weight = num(r["몸무게"])
        is_rest = not made_session
        if is_rest:
            rest_days += 1
        if weight is not None or note or is_rest:
            key = (PERSON_ID, day)
            prev = notes.get(key)
            if prev is None:
                notes[key] = {"person_id": PERSON_ID, "logged_on": day,
                              "weight_kg": weight, "note": note,
                              "is_rest": is_rest, "source": "gform"}
            else:  # 같은 날 2행 -> 비고는 이어 붙이고, 하나라도 운동했으면 휴식 아님
                if weight is not None:
                    prev["weight_kg"] = weight
                if note:
                    prev["note"] = f"{prev['note']} / {note}" if prev["note"] else note
                prev["is_rest"] = prev["is_rest"] and is_rest

    s_df = pd.DataFrame(sessions).sort_values(["logged_on", "exercise"])
    n_df = pd.DataFrame(notes.values()).sort_values("logged_on")

    s_df.to_csv(out_dir / "workout_logs.csv", index=False)
    n_df.to_csv(out_dir / "daily_notes.csv", index=False)

    lines = [
        "구글 설문 -> Supabase 이관 리포트",
        f"원본 행 수         : {len(df)}",
        f"기간               : {df['logged_on'].min()} ~ {df['logged_on'].max()}",
        f"운동 세션 행       : {len(s_df)}",
        f"하루 단위 행       : {len(n_df)}  (휴식으로 분류: {rest_days})",
        "",
        "종목별 세션 수",
        s_df["exercise"].value_counts().to_string(),
        "",
        "연도별 세션 수",
        pd.to_datetime(s_df["logged_on"]).dt.year.value_counts().sort_index().to_string(),
        "",
        f"몸무게 기록        : {n_df['weight_kg'].notna().sum()}건",
        f"비고 살린 건수     : {n_df['note'].notna().sum()}건",
    ]
    report = "\n".join(lines)
    (out_dir / "migration_report.txt").write_text(report, encoding="utf-8")
    print(report)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "archive/구글설문_220611-260904.tsv")

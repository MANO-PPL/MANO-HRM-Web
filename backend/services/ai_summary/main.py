import os
import json
from enum import Enum
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from dotenv import load_dotenv
from groq import Groq

# Load environment variables from the backend root
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '.env')
load_dotenv(env_path)

app = FastAPI(title="Attendance AI Summary Service")

# Initialize Groq client
# Ensures we use exactly the key name present in backend/.env
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    raise ValueError("GROQ_API_KEY environment variable not found in .env")

client = Groq(api_key=api_key)

class EmployeeStatus(str, Enum):
    present = "present"
    absent = "absent"
    late = "late"
    on_leave = "on_leave"
    not_checked_in = "not_checked_in"

class EmployeeRecord(BaseModel):
    name: str
    department: str
    status: str

    check_in: Optional[str] = None
    check_out: Optional[str] = None

class DepartmentStat(BaseModel):
    department: str
    present: int
    absent: int
    late: int

class AnalyticsData(BaseModel):
    present_rate: float
    late_rate: float
    avg_work_hours: float
    department_breakdown: List[DepartmentStat]
    timeline_peaks: List[str]

class AttendanceSummaryInput(BaseModel):
    date: str
    total_employees: int
    employees: List[EmployeeRecord]
    analytics: AnalyticsData

    @field_validator('employees')
    @classmethod
    def check_employees_not_empty(cls, v):
        if not v:
            raise ValueError('Employee list cannot be empty')
        return v

class EmployeeSummaryNote(BaseModel):
    name: str = ""
    department: str = "Unassigned"
    status: str = "absent"
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    note: Optional[str] = None

class AnalyticsInsights(BaseModel):
    present_rate: float = 0.0
    late_rate: float = 0.0
    avg_work_hours: float = 8.0
    highlights: List[str] = Field(default_factory=list)

class AttendanceSummaryOutput(BaseModel):
    overall_summary: str = ""
    present_employees: List[EmployeeSummaryNote] = Field(default_factory=list)
    absent_employees: List[EmployeeSummaryNote] = Field(default_factory=list)
    on_leave_employees: List[EmployeeSummaryNote] = Field(default_factory=list)
    analytics_insights: AnalyticsInsights = Field(default_factory=AnalyticsInsights)

def generate_fallback_summary(payload: AttendanceSummaryInput) -> AttendanceSummaryOutput:
    present_list = []
    absent_list = []
    on_leave_list = []

    for emp in payload.employees:
        status_clean = emp.status.lower() if emp.status else 'absent'
        note = None
        if 'late' in status_clean:
            note = 'Arrived late'
        elif 'early' in status_clean:
            note = 'Left early'

        item = EmployeeSummaryNote(
            name=emp.name,
            department=emp.department or 'Unassigned',
            status=emp.status,
            check_in=emp.check_in,
            check_out=emp.check_out,
            note=note
        )
        if 'present' in status_clean or 'late' in status_clean or 'active' in status_clean:
            present_list.append(item)
        elif 'leave' in status_clean:
            on_leave_list.append(item)
        else:
            absent_list.append(item)

    present_rate = payload.analytics.present_rate
    late_rate = payload.analytics.late_rate
    avg_hours = payload.analytics.avg_work_hours or 8.0

    highlights = [
        f"Overall workplace attendance rate reached {present_rate:.1f}% for {payload.date}.",
        f"Late arrival frequency recorded at {late_rate:.1f}% across all active departments.",
        f"Average daily working shift duration logged at {avg_hours:.1f} hours."
    ]

    overall = (
        f"Attendance analysis for {payload.date} shows {len(present_list)} of {payload.total_employees} "
        f"staff members active or present ({present_rate:.1f}% attendance rate). "
        f"A total of {len(absent_list)} employees were marked absent and {len(on_leave_list)} on approved leave."
    )

    return AttendanceSummaryOutput(
        overall_summary=overall,
        present_employees=present_list,
        absent_employees=absent_list,
        on_leave_employees=on_leave_list,
        analytics_insights=AnalyticsInsights(
            present_rate=present_rate,
            late_rate=late_rate,
            avg_work_hours=avg_hours,
            highlights=highlights
        )
    )

@app.post("/summarize", response_model=AttendanceSummaryOutput)
async def summarize_attendance(payload: AttendanceSummaryInput):
    # Construct a structured prompt from the validated input
    input_json = payload.model_dump_json()
    
    prompt = f"""
    You are an AI assistant analyzing daily attendance records.
    Generate an insightful attendance summary for {payload.date} based on the following JSON data.
    
    Input data:
    {input_json}
    
    Instructions:
    1. Provide a brief 2-3 sentence overall_summary of the day's attendance.
    2. Categorize employees into present_employees, absent_employees, and on_leave_employees.
    3. Add a brief, helpful 'note' for employees if applicable (e.g., "Arrived 45 min late", "Left early").
    4. In the "analytics_insights" block, set "present_rate" and "late_rate" to the EXACT values provided in the input data's "analytics" -> "present_rate" and "late_rate". Do not recalculate or estimate them, copy them exactly.
    5. Generate 2-3 natural language observations in the "highlights" array (e.g., "Engineering had the highest late arrival rate"). Do not leave the highlights array empty.
    
    OUTPUT FORMAT:
    You must return ONLY a raw JSON object matching the exact structure below. Do NOT wrap the JSON in markdown formatting (like ```json), do not include any prose or explanations. Just the JSON object.
    
    {{
      "overall_summary": "string",
      "present_employees": [
        {{ "name": "string", "department": "string", "status": "string", "check_in": "string", "check_out": "string", "note": "string or null" }}
      ],
      "absent_employees": [],
      "on_leave_employees": [],
      "analytics_insights": {{
        "present_rate": float,
        "late_rate": float,
        "avg_work_hours": float,
        "highlights": ["string"]
      }}
    }}
    """
    
    candidate_models = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]
    
    for model_name in candidate_models:
        try:
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": "You are a professional attendance data analyst. You must return only a valid JSON object matching the requested structure. Ensure highlights are populated with actual observations and rates are copied exactly from the input data's analytics block."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            raw_response = completion.choices[0].message.content
            output_data = json.loads(raw_response)
            validated_output = AttendanceSummaryOutput(**output_data)
            return validated_output
            
        except json.JSONDecodeError:
            continue
        except Exception as e:
            print(f"Model {model_name} failed: {e}")
            continue

    # If all LLM attempts encounter rate limits, model issues or fail, return reliable structured fallback
    return generate_fallback_summary(payload)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)

import os
import sys
import json
import argparse
from pathlib import Path
import pypdf
from pydantic import BaseModel, Field
from typing import List, Optional
from groq import Groq

# Define the Pydantic schema for structured output validation
class CandidateReport(BaseModel):
    ai_score: int = Field(..., ge=0, le=100, description="Overall match percentage from 0 to 100")
    skill_match_score: int = Field(..., ge=0, le=100, description="Skill match score from 0 to 100")
    experience_match_score: int = Field(..., ge=0, le=100, description="Experience match score from 0 to 100")
    education_match_score: int = Field(..., ge=0, le=100, description="Education match score from 0 to 100")
    culture_fit_score: int = Field(..., ge=0, le=100, description="Culture fit score from 0 to 100")
    ai_strengths: List[str] = Field(..., description="List of key strengths of the candidate based on the job requirements, resume, and inputs")
    ai_weaknesses: List[str] = Field(..., description="List of key weaknesses or gaps of the candidate based on the job requirements, resume, and inputs")
    ai_recommendation: str = Field(..., description="One of: 'Highly Recommended', 'Recommended', 'Under Consideration'")
    extracted_skills: List[str] = Field(..., description="List of specific skills identified from the resume and form inputs")
    total_experience: str = Field(..., description="Estimated total experience, e.g., '3 Years'")
    relevant_experience: str = Field(..., description="Estimated relevant experience for the job, e.g., '2.5 Years'")
    education: str = Field(..., description="Highest education degree, e.g., 'Bachelor of Engineering'")
    certifications: Optional[str] = Field("", description="Key certifications identified")
    projects: Optional[str] = Field("", description="Significant projects mentioned")
    achievements: Optional[str] = Field("", description="Key professional or academic achievements")

def load_env():
    """Load environment variables from the parent project's .env file if not already set."""
    if os.environ.get("GROQ_API_KEY"):
        return
    try:
        script_dir = Path(__file__).resolve().parent
        # backend/.env is located 3 directories up from backend/src/services/recruitment/
        env_path = script_dir.parents[2] / ".env"
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        v = v.strip().strip('"').strip("'")
                        os.environ[k.strip()] = v
    except Exception as e:
        print(f"Warning: Failed to load .env file: {e}", file=sys.stderr)

def extract_pdf_text(filepath: str) -> str:
    """Extract all text contents from a PDF file using pypdf."""
    if not filepath or not os.path.exists(filepath):
        return ""
    try:
        reader = pypdf.PdfReader(filepath)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except Exception as e:
        print(f"Warning: Failed to read PDF {filepath}: {e}", file=sys.stderr)
        return ""

def main():
    # Force stdout/stderr to use UTF-8 to avoid UnicodeEncodeError on Windows
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

    parser = argparse.ArgumentParser(description="Generate AI Candidate report using Groq and Pydantic validation.")
    parser.add_argument("--resume-path", help="Path to candidate resume PDF file")
    parser.add_argument("--job-title", required=True, help="Title of the job opening")
    parser.add_argument("--job-skills", default="", help="Skills required for the job opening")
    parser.add_argument("--job-experience", default="", help="Experience required for the job opening")
    parser.add_argument("--form-responses", required=True, help="JSON string representing form responses from candidate")
    
    args = parser.parse_args()
    
    load_env()
    
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        print(json.dumps({"error": "GROQ_API_KEY is not set in environment or .env file."}))
        sys.exit(1)
        
    model = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")
    
    # 1. Parse candidate responses
    try:
        form_responses = json.loads(args.form_responses)
    except Exception as e:
        print(json.dumps({"error": f"Invalid form-responses JSON string: {e}"}))
        sys.exit(1)
        
    # 2. Extract text from PDF resume (if provided)
    resume_text = ""
    if args.resume_path:
        resume_text = extract_pdf_text(args.resume_path)
        
    # 3. Build AI evaluation prompt containing ONLY the candidate's resume, form responses, and job requirements
    system_prompt = (
        "You are an expert recruitment and hiring assistant. "
        "Analyze the candidate's credentials strictly against the specified job opening details. "
        "Ensure your assessment is based ONLY on the candidate's resume text and their responses to the form questions. "
        "Do not include any hypothetical, external, or hallucinated facts. "
        "You must respond with a strict JSON object that conforms to the requested JSON schema. "
        "No preamble, no conversational text, only the raw JSON payload."
    )
    
    user_prompt = f"""
=== JOB DETAILS ===
Job Title: {args.job_title}
Required Skills: {args.job_skills}
Experience Required: {args.job_experience}

=== CANDIDATE INPUTS (FORM RESPONSES) ===
{json.dumps(form_responses, indent=2)}

=== CANDIDATE RESUME TEXT ===
{resume_text if resume_text else "[No resume file uploaded]"}

=== EXPECTED JSON SCHEMA STRUCTURE ===
Your JSON response must contain these fields:
- "ai_score": (int) overall matching score from 0 to 100.
- "skill_match_score": (int) score from 0 to 100.
- "experience_match_score": (int) score from 0 to 100.
- "education_match_score": (int) score from 0 to 100.
- "culture_fit_score": (int) score from 0 to 100.
- "ai_strengths": (list of strings) key strengths matching job requirements.
- "ai_weaknesses": (list of strings) areas of improvement or gaps.
- "ai_recommendation": (string) one of "Highly Recommended", "Recommended", or "Under Consideration".
- "extracted_skills": (list of strings) skills found in resume/inputs.
- "total_experience": (string) e.g. "5 Years".
- "relevant_experience": (string) e.g. "3 Years".
- "education": (string) highest educational degree.
- "certifications": (string) certifications mentioned.
- "projects": (string) list of relevant projects.
- "achievements": (string) achievements mentioned.

Generate the evaluation report now in strict JSON format:
"""

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            response_format={"type": "json_object"}
        )
        
        raw_content = response.choices[0].message.content
        if not raw_content:
            raise ValueError("Groq returned an empty response.")
            
        # 4. Parse and validate the response against the Pydantic schema
        validated_report = CandidateReport.model_validate_json(raw_content)
        
        # 5. Output the valid JSON structure to stdout
        print(validated_report.model_dump_json())
        
    except Exception as e:
        print(json.dumps({"error": f"AI evaluation or validation failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()

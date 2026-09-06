import os
from datetime import datetime, timezone
from flask import Flask, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
app.config["SECRET_KEY"] = "resourceradar-secure-key-2026"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///resourceradar.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(150), nullable=False)
    institute_name = db.Column(db.String(150), nullable=False)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    date_created = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<User {self.id}: {self.username}>"


class Report(db.Model):
    __tablename__ = "reports"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    institute_name = db.Column(db.String(150), nullable=False)
    location = db.Column(db.String(150), nullable=False)
    category = db.Column(db.String(50), nullable=False)  # 'energy', 'water', 'waste'
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default="reported")  # 'reported', 'fixed'
    date_created = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    def __repr__(self):
        return f"<Report {self.id} - {self.institute_name} ({self.category})>"


class CalculatorResult(db.Model):
    __tablename__ = "calculator_results"

    id = db.Column(db.Integer, primary_key=True)
    energy_score = db.Column(db.Integer, nullable=False)  # 0 to 33 (waste score)
    water_score = db.Column(db.Integer, nullable=False)   # 0 to 33 (waste score)
    waste_score = db.Column(db.Integer, nullable=False)   # 0 to 33 (waste score)
    total_score = db.Column(db.Integer, nullable=False)   # 0 to 100 (efficiency score)
    date_created = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc)
    )

    def __repr__(self):
        return f"<CalculatorResult {self.id}: Total={self.total_score}>"


with app.app_context():
    db.create_all()
    try:
        with db.engine.connect() as conn:
            columns = [col[1] for col in conn.execute(db.text("PRAGMA table_info(reports)")).fetchall()]
            if "user_id" not in columns:
                conn.execute(db.text("ALTER TABLE reports ADD COLUMN user_id INTEGER REFERENCES users(id)"))
                conn.commit()
    except Exception:
        pass


def compute_calculator_scores(form_dict):
    # Step 1 — Energy:
    # light_units = num_lights * light_hours
    # ac_units = num_ac * ac_hours
    # total_energy = light_units + ac_units
    # If total_energy > 300 -> energy_waste = 33
    # If total_energy between 150 and 300 -> energy_waste = 20
    # If total_energy < 150 -> energy_waste = 10
    try:
        num_lights = float(form_dict.get("num_lights", 0) or 0)
    except (ValueError, TypeError):
        num_lights = 0.0
    try:
        light_hours = float(form_dict.get("light_hours", 0) or 0)
    except (ValueError, TypeError):
        light_hours = 0.0
    try:
        num_ac = float(form_dict.get("num_ac", 0) or 0)
    except (ValueError, TypeError):
        num_ac = 0.0
    try:
        ac_hours = float(form_dict.get("ac_hours", 0) or 0)
    except (ValueError, TypeError):
        ac_hours = 0.0

    light_units = max(0.0, num_lights) * max(0.0, light_hours)
    ac_units = max(0.0, num_ac) * max(0.0, ac_hours)
    total_energy = light_units + ac_units

    if total_energy > 300:
        energy_waste = 33
    elif total_energy >= 150:
        energy_waste = 20
    else:
        energy_waste = 10

    # Step 2 — Water:
    # water_units = num_taps * water_hours
    # If leakage = Yes -> add 10 to water_units
    # If water_units > 100 -> water_waste = 33
    # If water_units between 50 and 100 -> water_waste = 20
    # If water_units < 50 -> water_waste = 10
    try:
        num_taps = float(form_dict.get("num_taps", 0) or 0)
    except (ValueError, TypeError):
        num_taps = 0.0
    try:
        water_hours = float(form_dict.get("water_hours", 0) or 0)
    except (ValueError, TypeError):
        water_hours = 0.0

    leakage = str(form_dict.get("leakage", "no")).strip().lower()
    water_units = max(0.0, num_taps) * max(0.0, water_hours)
    if leakage == "yes":
        water_units += 10.0

    if water_units > 100:
        water_waste = 33
    elif water_units >= 50:
        water_waste = 20
    else:
        water_waste = 10

    # Step 3 — Waste:
    # Base from food_waste: Low = 5, Medium = 15, High = 25
    # waste_units = daily_waste_kg * 10 + food_waste_base
    # If recycling = No -> add 8 to waste_units
    # If waste_units > 100 -> waste_waste = 33
    # If waste_units between 50 and 100 -> waste_waste = 20
    # If waste_units < 50 -> waste_waste = 10
    try:
        daily_waste_kg = float(form_dict.get("daily_waste_kg", 0) or 0)
    except (ValueError, TypeError):
        daily_waste_kg = 0.0

    food_waste = str(form_dict.get("food_waste", "medium")).strip().lower()
    if food_waste == "low":
        food_waste_base = 5.0
    elif food_waste == "high":
        food_waste_base = 25.0
    else:
        food_waste_base = 15.0

    waste_units = max(0.0, daily_waste_kg) * 10.0 + food_waste_base
    recycling = str(form_dict.get("recycling", "yes")).strip().lower()
    if recycling == "no":
        waste_units += 8.0

    if waste_units > 100:
        waste_waste = 33
    elif waste_units >= 50:
        waste_waste = 20
    else:
        waste_waste = 10

    # Final Score:
    total_score = 100 - (energy_waste + water_waste + waste_waste)
    return energy_waste, water_waste, waste_waste, total_score


with app.app_context():
    db.create_all()
    # Pre-seed 12 realistic dummy CalculatorResult entries if table is empty
    if CalculatorResult.query.count() == 0:
        dummy_entries = [
            (10, 10, 10, 70),
            (10, 20, 10, 60),
            (20, 10, 10, 60),
            (20, 20, 10, 50),
            (10, 20, 20, 50),
            (20, 20, 20, 40),
            (33, 10, 10, 47),
            (10, 33, 10, 47),
            (10, 10, 33, 47),
            (33, 20, 10, 37),
            (20, 33, 10, 37),
            (10, 10, 20, 60),
        ]
        for e_score, w_score, wt_score, t_score in dummy_entries:
            dummy_record = CalculatorResult(
                energy_score=e_score,
                water_score=w_score,
                waste_score=wt_score,
                total_score=t_score,
            )
            db.session.add(dummy_record)
        db.session.commit()


@app.route("/")
def index():
    total_reports = Report.query.count()
    fixed_reports = Report.query.filter_by(status="fixed").count()
    spaces_count = (
        db.session.query(db.func.count(db.func.distinct(Report.location))).scalar()
        or 0
    )
    return render_template(
        "index.html",
        total_reports=total_reports,
        fixed_reports=fixed_reports,
        reports_count=total_reports,
        fixed_count=fixed_reports,
        spaces_count=spaces_count,
    )


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/report", methods=["GET", "POST"])
def report():
    errors = {}
    form_data = {
        "name": session.get("full_name", ""),
        "institute_name": session.get("institute_name", ""),
        "location": "",
        "category": "",
        "description": "",
    }

    if request.method == "POST":
        if session.get("user_id"):
            form_data["name"] = session.get("full_name", "")
            form_data["institute_name"] = session.get("institute_name", "")
        else:
            form_data["name"] = request.form.get("name", "").strip()
            form_data["institute_name"] = request.form.get("institute_name", "").strip()

        form_data["location"] = request.form.get("location", "").strip()
        form_data["category"] = request.form.get("category", "").strip().lower()
        form_data["description"] = request.form.get("description", "").strip()

        # Server-side validation
        if not form_data["name"]:
            errors["name"] = "Please enter your name."
        if not form_data["institute_name"]:
            errors["institute_name"] = "Please enter your institute name."
        if not form_data["location"]:
            errors["location"] = "Please specify the location."
        if not form_data["category"] or form_data["category"] not in ["energy", "water", "waste"]:
            errors["category"] = "Please select a category (energy, water, or waste)."
        if not form_data["description"]:
            errors["description"] = "Please provide a description of the issue."

        if not errors:
            user_id = session.get("user_id")
            new_report = Report(
                name=form_data["name"],
                institute_name=form_data["institute_name"],
                location=form_data["location"],
                category=form_data["category"],
                description=form_data["description"],
                status="reported",
                user_id=user_id,
            )
            db.session.add(new_report)
            db.session.commit()
            return redirect(url_for("report"))

    reports = Report.query.order_by(Report.date_created.desc()).all()
    return render_template(
        "report.html",
        reports=reports,
        errors=errors,
        form_data=form_data,
        active_page="report",
    )


@app.route("/report/edit/<int:id>", methods=["GET", "POST"])
def edit_report(id):
    report_item = db.session.get(Report, id)
    if not report_item or not session.get("user_id") or report_item.user_id != session.get("user_id"):
        return redirect(url_for("report"))

    errors = {}
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        institute_name = request.form.get("institute_name", "").strip()
        location = request.form.get("location", "").strip()
        category = request.form.get("category", "").strip().lower()
        description = request.form.get("description", "").strip()

        form_data = {
            "name": name,
            "institute_name": institute_name,
            "location": location,
            "category": category,
            "description": description,
        }

        # Server-side validation
        if not name:
            errors["name"] = "Please enter your name."
        if not institute_name:
            errors["institute_name"] = "Please enter your institute name."
        if not location:
            errors["location"] = "Please specify the location."
        if not category or category not in ["energy", "water", "waste"]:
            errors["category"] = "Please select a category (energy, water, or waste)."
        if not description:
            errors["description"] = "Please provide a description of the issue."

        if not errors:
            report_item.name = name
            report_item.institute_name = institute_name
            report_item.location = location
            report_item.category = category
            report_item.description = description
            db.session.commit()
            return redirect(url_for("report"))
    else:
        form_data = {
            "name": report_item.name,
            "institute_name": report_item.institute_name,
            "location": report_item.location,
            "category": report_item.category,
            "description": report_item.description,
        }

    return render_template(
        "edit_report.html",
        report=report_item,
        errors=errors,
        form_data=form_data,
        active_page="report",
    )


@app.route("/report/delete/<int:id>", methods=["GET", "POST"])
def delete_report(id):
    report_item = db.session.get(Report, id)
    if report_item and session.get("user_id") and report_item.user_id == session.get("user_id"):
        db.session.delete(report_item)
        db.session.commit()
    return redirect(url_for("report"))


@app.route("/report/fixed/<int:id>", methods=["GET", "POST"])
def report_fixed(id):
    report_item = db.session.get(Report, id)
    if report_item and session.get("user_id") and report_item.user_id == session.get("user_id"):
        report_item.status = "fixed"
        db.session.commit()
    return redirect(url_for("report"))


@app.route("/calculator", methods=["GET", "POST"])
def calculator():
    if request.method == "POST":
        energy_waste, water_waste, waste_waste, total_score = compute_calculator_scores(request.form)
        new_result = CalculatorResult(
            energy_score=energy_waste,
            water_score=water_waste,
            waste_score=waste_waste,
            total_score=total_score,
        )
        db.session.add(new_result)
        db.session.commit()
        session["last_calc_id"] = new_result.id
        return redirect(url_for("calculator_result", id=new_result.id))

    last_result = None
    last_calc_id = session.get("last_calc_id")
    if last_calc_id:
        last_result = db.session.get(CalculatorResult, last_calc_id)

    return render_template(
        "calculator.html",
        active_page="calculator",
        last_result=last_result,
    )


@app.route("/calculator/result")
def calculator_result():
    result_id = request.args.get("id", type=int) or session.get("last_calc_id")
    result = None
    if result_id:
        result = db.session.get(CalculatorResult, result_id)
    if not result:
        result = CalculatorResult.query.order_by(CalculatorResult.date_created.desc()).first()

    if not result:
        return redirect(url_for("calculator"))

    # Community average calculated across all rows in DB using avg()
    avg_score_raw = db.session.query(db.func.avg(CalculatorResult.total_score)).scalar()
    community_avg = round(float(avg_score_raw), 1) if avg_score_raw is not None else 50.0
    score_diff = round(result.total_score - community_avg, 1)

    # Status classification: Good (>70), Average (40-70), Needs Improvement (<40)
    if result.total_score > 70:
        status_label = "Good"
        status_class = "status-good"
    elif result.total_score >= 40:
        status_label = "Average"
        status_class = "status-average"
    else:
        status_label = "Needs Improvement"
        status_class = "status-needs-improvement"

    # Personalized tip based on which category had the highest waste score
    highest_waste = max(result.energy_score, result.water_score, result.waste_score)
    tips = []
    if result.energy_score == highest_waste:
        tips.append("Your space uses a lot of energy. Try turning off lights and fans when rooms are empty, and opt for natural lighting during daytime.")
    if result.water_score == highest_waste:
        tips.append("Water consumption is your biggest area of waste. Inspect taps for dripping leaks, install aerators, and encourage mindful shower and tap use.")
    if result.waste_score == highest_waste:
        tips.append("Solid waste and food disposal need attention. Implement segregated recycling bins, reduce disposable packaging, and avoid food over-purchasing.")

    personalized_tip = tips[0] if tips else "Maintain your resource-conscious habits and track improvements over time."

    return render_template(
        "calculator_result.html",
        active_page="calculator",
        result=result,
        community_avg=community_avg,
        score_diff=score_diff,
        status_label=status_label,
        status_class=status_class,
        personalized_tip=personalized_tip,
    )


@app.route("/resources")
def resources():
    return render_template(
        "resources.html",
        active_page="resources",
    )


@app.route("/contact")
def contact():
    return render_template(
        "contact.html",
        active_page="contact",
    )


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET" and session.get("user_id"):
        return redirect(url_for("index"))

    active_tab = request.args.get("tab", "signup")
    signup_errors = {}
    login_errors = {}
    signup_data = {
        "full_name": "",
        "institute_name": "",
        "username": "",
    }
    login_data = {
        "username": "",
    }

    if request.method == "POST":
        action = request.form.get("action", "").strip()

        if action == "signup":
            active_tab = "signup"
            full_name = request.form.get("full_name", "").strip()
            institute_name = request.form.get("institute_name", "").strip()
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")
            confirm_password = request.form.get("confirm_password", "")

            signup_data["full_name"] = full_name
            signup_data["institute_name"] = institute_name
            signup_data["username"] = username

            # Server-side validation for Sign Up
            if not full_name:
                signup_errors["full_name"] = "Please enter your full name."
            if not institute_name:
                signup_errors["institute_name"] = "Please enter your institute name."
            if not username:
                signup_errors["username"] = "Please enter a username."
            if not password:
                signup_errors["password"] = "Please enter a password."
            if not confirm_password:
                signup_errors["confirm_password"] = "Please confirm your password."

            if password and confirm_password and password != confirm_password:
                signup_errors["confirm_password"] = "Passwords do not match."

            if username and not signup_errors.get("username"):
                existing_user = User.query.filter_by(username=username).first()
                if existing_user:
                    signup_errors["username"] = "Username already taken. Try another."

            if not signup_errors:
                password_hash = generate_password_hash(password)
                new_user = User(
                    full_name=full_name,
                    institute_name=institute_name,
                    username=username,
                    password_hash=password_hash,
                )
                db.session.add(new_user)
                db.session.commit()

                session["user_id"] = new_user.id
                session["username"] = new_user.username
                session["full_name"] = new_user.full_name
                session["institute_name"] = new_user.institute_name
                return redirect(url_for("index"))

        elif action == "login":
            active_tab = "login"
            username = request.form.get("username", "").strip()
            password = request.form.get("password", "")

            login_data["username"] = username

            if not username:
                login_errors["username"] = "Please enter your username."
            if not password:
                login_errors["password"] = "Please enter your password."

            if not login_errors:
                user = User.query.filter_by(username=username).first()
                if not user:
                    login_errors["username"] = "Username not found."
                elif not check_password_hash(user.password_hash, password):
                    login_errors["password"] = "Incorrect password."
                else:
                    session["user_id"] = user.id
                    session["username"] = user.username
                    session["full_name"] = user.full_name
                    session["institute_name"] = user.institute_name
                    return redirect(url_for("index"))

    return render_template(
        "login.html",
        active_tab=active_tab,
        signup_errors=signup_errors,
        login_errors=login_errors,
        signup_data=signup_data,
        login_data=login_data,
        active_page="login",
    )


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)

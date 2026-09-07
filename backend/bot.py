"""
mzayn_bot.py - بوت نظام مزاين التفاعلي (Interactive Dashboard)
يدعم:
1. إنشاء شات خاص (Private Thread) سري لكل عضو بنقرة زر واحدة
2. رفع كشوفات النياق (ألبوم صور أو ملف ZIP) ومعالجتها في الخلفية دون انقطاع
3. تسجيل وتعديل المنقية
4. إعدادات البطولة والتباعد
5. حساب أفضل تشكيلة للبطولة بمحرك OR-Tools
6. استعراض النياق والإحصائيات
7. تعديل وحذف النياق يدوياً
"""

import os
import io
import zipfile
import asyncio
from typing import Optional, List
import discord
from discord import app_commands, ui
from discord.ext import commands
from dotenv import load_dotenv
from sqlalchemy.orm import Session

# Backend imports
from database import SessionLocal
from models.stable import Stable
from models.camel import Camel
from models.championship import Championship
from services.ocr_service import extract_camel_data_from_image
from services.optimizer_service import optimize_championship

load_dotenv()

TOKEN = os.getenv("DISCORD_BOT_TOKEN")

intents = discord.Intents.default()
intents.message_content = True
intents.members = True

bot = commands.Bot(command_prefix="!", intents=intents)

ATTR_NAMES_AR = {
    "neck": "الرقبة",
    "lips": "الشفاه",
    "nose": "الأنف",
    "head": "الرأس",
    "eyelashes": "الرموش",
    "ear": "الأذن",
    "hump": "السنام",
}
ATTRIBUTES = ["neck", "lips", "nose", "head", "eyelashes", "ear", "hump"]


def get_user_stable(db: Session, user_id: str) -> Optional[Stable]:
    """جلب منقية العضو عبر Discord User ID"""
    return db.query(Stable).filter(Stable.discord_user_id == str(user_id)).first()


async def get_or_create_stable_thread(channel, user, stable: Stable) -> discord.Thread:
    """البحث عن شات خاص للمنقية أو إنشاؤه تلقائياً"""
    thread_name = f"🔒-{stable.name}"

    # 1. فحص الثردات النشطة
    if hasattr(channel, 'threads'):
        for t in channel.threads:
            if t.name == thread_name and not t.archived:
                try:
                    await t.add_user(user)
                except Exception:
                    pass
                return t

    # 2. إنشاء ثرد جديد (خاص أو عام)
    target_thread = None
    try:
        target_thread = await channel.create_thread(
            name=thread_name,
            type=discord.ChannelType.private_thread,
            auto_archive_duration=1440
        )
    except Exception:
        target_thread = await channel.create_thread(
            name=thread_name,
            type=discord.ChannelType.public_thread,
            auto_archive_duration=1440
        )

    try:
        await target_thread.add_user(user)
    except Exception:
        pass

    # إرسال رسالة ترحيبية داخل الثرد مع لوحة التحكم
    welcome_embed = discord.Embed(
        title=f"🔒 شات منقية: {stable.name}",
        description=(
            f"مرحباً بك يا {user.mention} في غرفتك الخاصة!\n\n"
            "**📸 ارفع صور كشوفات نياقك هنا مباشرة:**\n"
            "• أرسل صورة أو ألبوم صور (10 أو 30 صورة معاً) أو ملف ZIP.\n"
            "• سيقوم البوت باستخراج نقاط وصفات النياق وحفظها تلقائياً.\n\n"
            "🚀 بعد الانتهاء اضغط زر **حساب أفضل تشكيلة للبطولة** لاستخراج النتيجة المثالية!"
        ),
        color=0x16A34A
    )
    welcome_embed.set_footer(text="نظام مزاين الذكي • سرية وأمان تام")
    await target_thread.send(embed=welcome_embed, view=MainControlView())
    return target_thread


# ------------------------------------------------------------------ #
# Modals (النوافذ المنبثقة التفاعلية)                                  #
# ------------------------------------------------------------------ #

class RegisterStableModal(ui.Modal, title="🏷️ تسجيل أو تعديل اسم المنقية"):
    stable_name = ui.TextInput(
        label="اسم المنقية",
        placeholder="مثال: منقية الصفر، الحداري، صاد...",
        required=True,
        max_length=100
    )

    async def on_submit(self, interaction: discord.Interaction):
        db = SessionLocal()
        try:
            user_id = str(interaction.user.id)
            username = str(interaction.user.name)
            name_val = self.stable_name.value.strip()

            user_stable = get_user_stable(db, user_id)
            existing_stable_with_name = db.query(Stable).filter(Stable.name == name_val).first()

            if user_stable:
                if existing_stable_with_name and existing_stable_with_name.id != user_stable.id:
                    embed = discord.Embed(
                        title="⚠️ اسم المنقية مسجل مسبقاً",
                        description=f"اسم **{name_val}** مسجل بالفعل لمنقية أخرى. يرجى اختيار اسم مختلف.",
                        color=0xF59E0B
                    )
                    await interaction.response.send_message(embed=embed, ephemeral=True)
                    return
                user_stable.name = name_val
                user_stable.discord_username = username
                db.commit()
                active_stable = user_stable
            else:
                if existing_stable_with_name:
                    if not existing_stable_with_name.discord_user_id or existing_stable_with_name.discord_user_id == user_id:
                        existing_stable_with_name.discord_user_id = user_id
                        existing_stable_with_name.discord_username = username
                        db.commit()
                        active_stable = existing_stable_with_name
                    else:
                        embed = discord.Embed(
                            title="❌ اسم المنقية مستخدم",
                            description=f"منقية **{name_val}** مسجلة بالفعل لعضو آخر.",
                            color=0xDC2626
                        )
                        await interaction.response.send_message(embed=embed, ephemeral=True)
                        return
                else:
                    new_stable = Stable(
                        name=name_val,
                        discord_user_id=user_id,
                        discord_username=username,
                        description=f"منقية مسجلة عبر ديسكورد بواسطة @{username}"
                    )
                    db.add(new_stable)
                    db.commit()
                    active_stable = new_stable

            # إنشاء الشات الخاص تلقائياً فور تسجيل المنقية والدخول إليه مباشرة
            thread_link = ""
            try:
                thread = await get_or_create_stable_thread(interaction.channel, interaction.user, active_stable)
                thread_link = f"\n\n👉 **تفضل بالدخول إلى شاتك السري من هنا:** {thread.mention}\n(ارفع صور نياقك داخله ليتم قراءتها وحفظها تلقائياً)"
            except Exception as te:
                thread_link = f"\n\n*(اضغط زر 🔒 فتح شات منقيتي الخاص بعد التأكد من إعطاء البوت رتبة Administrator أو صلاحية إنشاء الثردات: {str(te)})*"

            embed = discord.Embed(
                title="🎉 تم تسجيل المنقية بنجاح!",
                description=f"أهلاً بك يا {interaction.user.mention}، تم تسجيل منقية **{active_stable.name}** في النظام بنجاح.{thread_link}",
                color=0x16A34A
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            try:
                await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)
            except Exception:
                pass
        finally:
            db.close()


class TournamentSettingsModal(ui.Modal, title="⚙️ إعدادات نياق البطولة والتباعد"):
    min_camels = ui.TextInput(
        label="الحد الأدنى لعدد النياق",
        placeholder="مثال: 10 أو 50",
        required=True,
        default="10",
        max_length=4
    )
    max_camels = ui.TextInput(
        label="الحد الأعلى لعدد النياق",
        placeholder="مثال: 10 أو 60",
        required=True,
        default="10",
        max_length=4
    )
    required_spacing = ui.TextInput(
        label="التباعد المطلوب (0 يعني تماثل تام)",
        placeholder="اتركه فارغاً إذا بدون شرط تباعد، أو ضع 0 أو 1...",
        required=False,
        max_length=4
    )

    async def on_submit(self, interaction: discord.Interaction):
        db = SessionLocal()
        try:
            user_id = str(interaction.user.id)
            stable = get_user_stable(db, user_id)
            if not stable:
                await interaction.response.send_message(
                    "⚠️ يرجى تسجيل منقيتك أولاً بالضغط على زر **🏷️ تسجيل / تعديل المنقية**.",
                    ephemeral=True
                )
                return

            try:
                min_c = int(self.min_camels.value.strip())
                max_c = int(self.max_camels.value.strip())
                req_sp = int(self.required_spacing.value.strip()) if self.required_spacing.value.strip() else None
            except ValueError:
                await interaction.response.send_message("❌ يرجى إدخال أرقام صحيحة فقط.", ephemeral=True)
                return

            if min_c > max_c:
                await interaction.response.send_message("❌ الحد الأدنى لا يمكن أن يكون أكبر من الحد الأعلى.", ephemeral=True)
                return

            stable.min_camels = min_c
            stable.max_camels = max_c
            stable.required_spacing = req_sp
            db.commit()

            embed = discord.Embed(
                title=f"⚙️ تم حفظ إعدادات بطولة منقية: {stable.name}",
                color=0x2563EB
            )
            embed.add_field(name="الحد الأدنى للنياق", value=f"**{min_c}** ناقة", inline=True)
            embed.add_field(name="الحد الأعلى للنياق", value=f"**{max_c}** ناقة", inline=True)
            embed.add_field(
                name="التباعد المطلوب",
                value=f"**{req_sp}** (تماثل تام)" if req_sp == 0 else f"**{req_sp}**" if req_sp is not None else "بدون شرط تباعد",
                inline=True
            )
            embed.set_footer(text="يمكنك الآن تشغيل الحساب بالضغط على زر (🚀 حساب أفضل تشكيلة للبطولة)")
            await interaction.response.send_message(embed=embed, ephemeral=True)
        finally:
            db.close()


class AddManualCamelModal(ui.Modal, title="➕ إضافة ناقة يدوياً"):
    number = ui.TextInput(label="رقم الناقة *", placeholder="مثال: 15", required=True, max_length=50)
    name = ui.TextInput(label="اسم الناقة (اختياري)", placeholder="اسم الناقة...", required=False, max_length=100)
    attrs_part1 = ui.TextInput(
        label="الرقبة - الشفاه - الأنف - الرأس (مفصولة بمسافة)",
        placeholder="مثال: 315 312 314 316",
        required=True,
        max_length=50
    )
    attrs_part2 = ui.TextInput(
        label="الرموش - الأذن - السنام (مفصولة بمسافة)",
        placeholder="مثال: 313 315 312",
        required=True,
        max_length=50
    )

    async def on_submit(self, interaction: discord.Interaction):
        db = SessionLocal()
        try:
            user_id = str(interaction.user.id)
            stable = get_user_stable(db, user_id)
            if not stable:
                await interaction.response.send_message("⚠️ يرجى تسجيل منقيتك أولاً عبر زر (🏷️ تسجيل / تعديل المنقية)!", ephemeral=True)
                return

            p1 = [int(x) for x in self.attrs_part1.value.replace(',', ' ').split() if x.isdigit()]
            p2 = [int(x) for x in self.attrs_part2.value.replace(',', ' ').split() if x.isdigit()]
            all_attrs = p1 + p2

            if len(all_attrs) != 7:
                await interaction.response.send_message(
                    "❌ يجب إدخال 7 أرقام تمثل الصفات السبع بالترتيب: (الرقبة، الشفاه، الأنف، الرأس، الرموش، الأذن، السنام).",
                    ephemeral=True
                )
                return

            neck, lips, nose, head, eyelashes, ear, hump = all_attrs
            points = sum(all_attrs)
            spacing = max(all_attrs) - min(all_attrs)

            new_camel = Camel(
                number=self.number.value.strip(),
                name=self.name.value.strip() or None,
                stable_id=stable.id,
                neck=neck,
                lips=lips,
                nose=nose,
                head=head,
                eyelashes=eyelashes,
                ear=ear,
                hump=hump,
                points=points,
                spacing=spacing,
                is_valid=True,
                points_valid=True,
                spacing_valid=True,
                status="available"
            )
            db.add(new_camel)
            db.commit()

            embed = discord.Embed(
                title=f"✅ تمت إضافة الناقة #{new_camel.number} بنجاح!",
                description=f"المنقية: **{stable.name}**\nالنقاط: **{points:,}** | التباعد: **{spacing}**",
                color=0x16A34A
            )
            attrs_str = f"الرقبة: **{neck}** | الشفاه: **{lips}** | الأنف: **{nose}** | الرأس: **{head}** | الرموش: **{eyelashes}** | الأذن: **{ear}** | السنام: **{hump}**"
            embed.add_field(name="الصفات السبع", value=attrs_str, inline=False)
            await interaction.response.send_message(embed=embed, ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ حدث خطأ: {str(e)}", ephemeral=True)
        finally:
            db.close()


class EditCamelModal(ui.Modal):
    def __init__(self, camel: Camel):
        super().__init__(title=f"✏️ تعديل ناقة #{camel.number}")
        self.camel_id = camel.id
        self.number = ui.TextInput(label="رقم الناقة *", default=str(camel.number), required=True, max_length=50)
        self.points_input = ui.TextInput(label="مجموع النقاط (اختياري)", default=str(camel.points or ""), required=False, max_length=10)
        self.spacing_input = ui.TextInput(label="التباعد (اختياري)", default=str(camel.spacing if camel.spacing is not None else ""), required=False, max_length=10)
        
        p1 = f"{camel.neck or 0} {camel.lips or 0} {camel.nose or 0} {camel.head or 0}"
        self.attrs_p1 = ui.TextInput(label="الرقبة - الشفاه - الأنف - الرأس (بمسافات)", default=p1, required=False, max_length=50)
        
        p2 = f"{camel.eyelashes or 0} {camel.ear or 0} {camel.hump or 0}"
        self.attrs_p2 = ui.TextInput(label="الرموش - الأذن - السنام (بمسافات)", default=p2, required=False, max_length=50)

        self.add_item(self.number)
        self.add_item(self.points_input)
        self.add_item(self.spacing_input)
        self.add_item(self.attrs_p1)
        self.add_item(self.attrs_p2)

    async def on_submit(self, interaction: discord.Interaction):
        db = SessionLocal()
        try:
            c = db.query(Camel).filter(Camel.id == self.camel_id).first()
            if not c:
                await interaction.response.send_message("❌ لم يتم العثور على الناقة.", ephemeral=True)
                return

            c.number = self.number.value.strip()

            p1_parts = [int(x) for x in self.attrs_p1.value.replace(',', ' ').split() if x.isdigit()]
            p2_parts = [int(x) for x in self.attrs_p2.value.replace(',', ' ').split() if x.isdigit()]
            all_attrs = p1_parts + p2_parts

            if len(all_attrs) == 7:
                c.neck, c.lips, c.nose, c.head, c.eyelashes, c.ear, c.hump = all_attrs
                c.points = sum(all_attrs)
                c.spacing = max(all_attrs) - min(all_attrs)
            else:
                if self.points_input.value.strip().isdigit():
                    c.points = int(self.points_input.value.strip())
                if self.spacing_input.value.strip().isdigit():
                    c.spacing = int(self.spacing_input.value.strip())

            c.is_valid = True
            c.needs_review = False
            db.commit()

            embed = discord.Embed(
                title=f"✅ تم تعديل بيانات الناقة #{c.number} بنجاح!",
                description=f"النقاط: **{c.points:,}** | التباعد: **{c.spacing}**",
                color=0x16A34A
            )
            embed.add_field(
                name="الصفات السبع",
                value=f"الرقبة: **{c.neck}** | الشفاه: **{c.lips}** | الأنف: **{c.nose}** | الرأس: **{c.head}** | الرموش: **{c.eyelashes}** | الأذن: **{c.ear}** | السنام: **{c.hump}**",
                inline=False
            )
            await interaction.response.send_message(embed=embed, ephemeral=True)
        finally:
            db.close()


# ------------------------------------------------------------------ #
# Manage Camels Dropdowns & Views                                     #
# ------------------------------------------------------------------ #

class EditCamelSelectDropdown(ui.Select):
    def __init__(self, camels: List[Camel]):
        options = []
        for c in camels[:25]:
            label = f"ناقة #{c.number}"
            if c.name:
                label += f" ({c.name})"
            desc = f"نقاط: {c.points or '—'} | تباعد: {c.spacing if c.spacing is not None else '—'}"
            options.append(discord.SelectOption(label=label, description=desc, value=str(c.id)))
        super().__init__(placeholder="✏️ اختر ناقة لتعديل بياناتها وصفاتها...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        camel_id = int(self.values[0])
        db = SessionLocal()
        try:
            c = db.query(Camel).filter(Camel.id == camel_id).first()
            if c:
                await interaction.response.send_modal(EditCamelModal(c))
            else:
                await interaction.response.send_message("❌ لم يتم العثور على الناقة.", ephemeral=True)
        finally:
            db.close()


class CamelSelectDropdown(ui.Select):
    def __init__(self, camels: List[Camel]):
        options = []
        for c in camels[:25]:
            label = f"ناقة #{c.number}"
            if c.name:
                label += f" ({c.name})"
            desc = f"نقاط: {c.points or '—'} | تباعد: {c.spacing if c.spacing is not None else '—'}"
            options.append(discord.SelectOption(label=label, description=desc, value=str(c.id)))
        super().__init__(placeholder="🗑️ اختر ناقة لحذفها من منقيتك...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        camel_id = int(self.values[0])
        db = SessionLocal()
        try:
            c = db.query(Camel).filter(Camel.id == camel_id).first()
            if c:
                num = c.number
                db.delete(c)
                db.commit()
                await interaction.response.send_message(f"🗑️ تم حذف الناقة **#{num}** بنجاح من منقيتك.", ephemeral=True)
            else:
                await interaction.response.send_message("❌ لم يتم العثور على الناقة.", ephemeral=True)
        finally:
            db.close()


class ManageCamelsView(ui.View):
    def __init__(self, camels: List[Camel], stable_id: int):
        super().__init__(timeout=120)
        self.stable_id = stable_id
        if camels:
            self.add_item(EditCamelSelectDropdown(camels))
            self.add_item(CamelSelectDropdown(camels))

    @ui.button(label="➕ إضافة ناقة يدوياً", style=discord.ButtonStyle.primary, emoji="➕", row=2)
    async def btn_add_manual(self, interaction: discord.Interaction, button: ui.Button):
        await interaction.response.send_modal(AddManualCamelModal())

    @ui.button(label="⚠️ تفريغ وحذف جميع نياق المنقية", style=discord.ButtonStyle.danger, emoji="🗑️", row=2)
    async def btn_delete_all(self, interaction: discord.Interaction, button: ui.Button):
        db = SessionLocal()
        try:
            count = db.query(Camel).filter(Camel.stable_id == self.stable_id).delete()
            db.commit()
            await interaction.response.send_message(f"🗑️ تم حذف جميع نياق منقيتك ({count} ناقة). يمكنك الآن رفع كشوفاتك من جديد.", ephemeral=True)
        finally:
            db.close()


# ------------------------------------------------------------------ #
# Main Buttons View (لوحة التحكم التفاعلية الشاملة)                  #
# ------------------------------------------------------------------ #

class MainControlView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)  # Persistent view

    # الصف الأول: تسجيل وفتح الشات الخاص
    @ui.button(label="تسجيل / تعديل المنقية", style=discord.ButtonStyle.primary, emoji="🏷️", custom_id="mzayn_btn_register", row=0)
    async def btn_register(self, interaction: discord.Interaction, button: ui.Button):
        await interaction.response.send_modal(RegisterStableModal())

    @ui.button(label="فتح شات منقيتي الخاص", style=discord.ButtonStyle.success, emoji="🔒", custom_id="mzayn_btn_open_thread", row=0)
    async def btn_open_thread(self, interaction: discord.Interaction, button: ui.Button):
        db = SessionLocal()
        try:
            user_id = str(interaction.user.id)
            stable = get_user_stable(db, user_id)
            if not stable:
                await interaction.response.send_message(
                    "⚠️ يرجى تسجيل منقيتك أولاً عبر الضغط على زر **🏷️ تسجيل / تعديل المنقية**.",
                    ephemeral=True
                )
                return

            channel = interaction.channel
            if isinstance(channel, discord.Thread):
                await interaction.response.send_message("أنت متواجد بالفعل في شات خاص! يمكنك رفع صورك هنا مباشرة.", ephemeral=True)
                return

            try:
                target_thread = await get_or_create_stable_thread(channel, interaction.user, stable)
                await interaction.response.send_message(
                    f"✅ تم فتح شاتك الخاص بنجاح! تفضل بالدخول إليه من هنا: {target_thread.mention}",
                    ephemeral=True
                )
            except discord.Forbidden:
                await interaction.response.send_message(
                    "❌ تعذر فتح الشات: يرجى التأكد من إعطاء رتبة البوت صلاحية **Administrator** أو تفعيل صلاحية (إنشاء الخيوط / Create Threads) في هذا الروم.",
                    ephemeral=True
                )
            except Exception as e:
                await interaction.response.send_message(f"❌ تعذر فتح الشات الخاص: {str(e)}", ephemeral=True)
        finally:
            db.close()

    # الصف الثاني: إعدادات البطولة والإضافة اليدوية
    @ui.button(label="إعدادات البطولة والتباعد", style=discord.ButtonStyle.secondary, emoji="⚙️", custom_id="mzayn_btn_settings", row=1)
    async def btn_settings(self, interaction: discord.Interaction, button: ui.Button):
        db = SessionLocal()
        try:
            stable = get_user_stable(db, str(interaction.user.id))
            if not stable:
                await interaction.response.send_message(
                    "⚠️ يرجى تسجيل منقيتك أولاً بالضغط على زر **🏷️ تسجيل / تعديل المنقية**.",
                    ephemeral=True
                )
                return
            modal = TournamentSettingsModal()
            modal.min_camels.default = str(stable.min_camels or 10)
            modal.max_camels.default = str(stable.max_camels or 10)
            modal.required_spacing.default = str(stable.required_spacing) if stable.required_spacing is not None else ""
            await interaction.response.send_modal(modal)
        finally:
            db.close()

    @ui.button(label="إضافة ناقة يدوياً", style=discord.ButtonStyle.primary, emoji="➕", custom_id="mzayn_btn_add_manual", row=1)
    async def btn_add_manual(self, interaction: discord.Interaction, button: ui.Button):
        await interaction.response.send_modal(AddManualCamelModal())

    # الصف الثالث: الحساب والإحصائيات
    @ui.button(label="حساب أفضل تشكيلة للبطولة", style=discord.ButtonStyle.success, emoji="🚀", custom_id="mzayn_btn_optimize", row=2)
    async def btn_optimize(self, interaction: discord.Interaction, button: ui.Button):
        db = SessionLocal()
        try:
            user_id = str(interaction.user.id)
            stable = get_user_stable(db, user_id)
            if not stable:
                await interaction.response.send_message(
                    "⚠️ لم تسجل منقيتك بعد! اضغط على زر **🏷️ تسجيل / تعديل المنقية**.",
                    ephemeral=True
                )
                return

            await interaction.response.defer(ephemeral=True, thinking=True)

            camels = db.query(Camel).filter(Camel.stable_id == stable.id).all()
            if not camels:
                await interaction.followup.send(
                    f"❌ لا توجد نياق مسجلة في منقية **{stable.name}** حتى الآن. يرجى رفع صور الكشوفات أولاً في شاتك الخاص.",
                    ephemeral=True
                )
                return

            min_c = stable.min_camels or 10
            max_c = stable.max_camels or min_c
            req_sp = stable.required_spacing

            camels_data = []
            for c in camels:
                camels_data.append({
                    "id": c.id,
                    "number": c.number,
                    "name": c.name,
                    "gender": c.gender,
                    "points": c.points,
                    "spacing": c.spacing,
                    "status": c.status,
                    "is_valid": c.is_valid,
                    "neck": c.neck,
                    "lips": c.lips,
                    "nose": c.nose,
                    "head": c.head,
                    "eyelashes": c.eyelashes,
                    "ear": c.ear,
                    "hump": c.hump,
                })

            opt_res = optimize_championship(
                camels=camels_data,
                min_camels=min_c,
                max_camels=max_c,
                required_spacing=req_sp,
                time_limit_seconds=30,
                optimization_goal="balanced"
            )

            if opt_res.get("solve_status") == "INFEASIBLE":
                embed = discord.Embed(
                    title="❌ تعذر العثور على تشكيلة مناسبة",
                    description=opt_res.get("message", "لا توجد نياق كافية تحقق الشروط المطلوبة."),
                    color=0xDC2626
                )
                embed.add_field(name="السبب المقترح", value="جرب تعديل شرط التباعد أو إضافة نياق أكثر لمنقيتك.", inline=False)
                await interaction.followup.send(embed=embed, ephemeral=True)
                return

            embed = discord.Embed(
                title=f"🏆 نتيجة التشكيلة المثالية لمنقية: {stable.name}",
                description=f"تم الحساب باستخدام محرك الذكاء والتحسين **OR-Tools**",
                color=0x16A34A
            )
            embed.add_field(name="عدد النياق بالتشكيلة", value=f"**{opt_res.get('num_camels')}** ناقة", inline=True)
            embed.add_field(name="مجموع النقاط الإجمالي", value=f"**{opt_res.get('total_points', 0):,}** نقطة", inline=True)
            embed.add_field(
                name="التباعد النهائي",
                value=f"**{opt_res.get('final_spacing')}**" + (" (تماثل تام ✅)" if opt_res.get('final_spacing') == 0 else ""),
                inline=True
            )

            selected = opt_res.get("selected_camels", [])
            if selected:
                camels_list = ", ".join([f"#{c.get('number')}" for c in selected[:35]])
                if len(selected) > 35:
                    camels_list += f" ...و {len(selected) - 35} نياق أخرى"
                embed.add_field(name="🐪 أرقام النياق المختارة بالتشكيلة", value=camels_list, inline=False)

            embed.set_footer(text=f"منقية {stable.name} • نظام مزاين")
            await interaction.followup.send(embed=embed, ephemeral=True)
        finally:
            db.close()

    @ui.button(label="استعراض نياقي وإحصائياتي", style=discord.ButtonStyle.secondary, emoji="📊", custom_id="mzayn_btn_stats", row=2)
    async def btn_stats(self, interaction: discord.Interaction, button: ui.Button):
        db = SessionLocal()
        try:
            user_id = str(interaction.user.id)
            stable = get_user_stable(db, user_id)
            if not stable:
                await interaction.response.send_message(
                    "⚠️ لم تسجل منقيتك بعد! اضغط على زر **🏷️ تسجيل / تعديل المنقية**.",
                    ephemeral=True
                )
                return

            camels = db.query(Camel).filter(Camel.stable_id == stable.id).order_by(Camel.points.desc()).all()
            total_camels = len(camels)
            valid_camels = len([c for c in camels if c.is_valid])
            needs_review = len([c for c in camels if c.needs_review])
            best_camel = camels[0] if camels else None

            embed = discord.Embed(
                title=f"🏠 إحصائيات منقية: {stable.name}",
                color=0x2563EB
            )
            embed.add_field(name="🐪 إجمالي النياق", value=str(total_camels), inline=True)
            embed.add_field(name="✅ النياق الصحيحة", value=str(valid_camels), inline=True)
            embed.add_field(name="⚠️ تحتاج مراجعة", value=str(needs_review), inline=True)

            embed.add_field(
                name="📏 إعدادات البطولة المحفوظة",
                value=f"العدد: **{stable.min_camels or 10} - {stable.max_camels or 10}** | التباعد: **{stable.required_spacing if stable.required_spacing is not None else 'بدون شرط'}**",
                inline=False
            )

            if best_camel and best_camel.points:
                embed.add_field(
                    name="⭐ أعلى ناقة نقاطاً",
                    value=f"ناقة رقم **#{best_camel.number}** ({best_camel.points:,} نقطة)",
                    inline=False
                )

            if camels:
                camels_summary = "\n".join([
                    f"• ناقة **#{c.number}** — نقاط: **{c.points or '—'}** | تباعد: **{c.spacing if c.spacing is not None else '—'}**"
                    for c in camels[:15]
                ])
                if len(camels) > 15:
                    camels_summary += f"\n...و {len(camels) - 15} نياق أخرى"
                embed.add_field(name="📋 قائمة النياق المسجلة", value=camels_summary, inline=False)

            await interaction.response.send_message(embed=embed, ephemeral=True)
        finally:
            db.close()

    # الصف الرابع: الإدارة والدخول للموقع
    @ui.button(label="إدارة وحذف نياق المنقية", style=discord.ButtonStyle.danger, emoji="🗑️", custom_id="mzayn_btn_manage", row=3)
    async def btn_manage(self, interaction: discord.Interaction, button: ui.Button):
        db = SessionLocal()
        try:
            user_id = str(interaction.user.id)
            stable = get_user_stable(db, user_id)
            if not stable:
                await interaction.response.send_message(
                    "⚠️ يرجى تسجيل منقيتك أولاً عبر زر **🏷️ تسجيل / تعديل المنقية**.",
                    ephemeral=True
                )
                return

            camels = db.query(Camel).filter(Camel.stable_id == stable.id).order_by(Camel.id.desc()).all()
            embed = discord.Embed(
                title=f"🛠️ إدارة نياق منقية: {stable.name}",
                description=f"لديك حالياً **{len(camels)}** ناقة مسجلة.\nيمكنك تعديل أي ناقة، أو اختيار ناقة لحذفها من القائمة المنسدلة، أو تفريغ المنقية بالكامل.",
                color=0xDC2626
            )
            view = ManageCamelsView(camels, stable.id)
            await interaction.response.send_message(embed=embed, view=view, ephemeral=True)
        finally:
            db.close()

    # زر رابط مباشر للموقع
    @ui.button(label="🌐 الدخول لمنصة الموقع الإلكتروني", style=discord.ButtonStyle.link, url="http://168.119.170.236", row=3)
    async def btn_web_link(self, interaction: discord.Interaction, button: ui.Button):
        pass


# ------------------------------------------------------------------ #
# Bot Events & Admin Setup Command                                   #
# ------------------------------------------------------------------ #

@bot.event
async def on_ready():
    bot.add_view(MainControlView())
    print("==================================================")
    print(f"تم تسجيل دخول البوت بنجاح: {bot.user.name}")
    print(f"معرف البوت: {bot.user.id}")
    print("==================================================")
    for guild in bot.guilds:
        try:
            bot.tree.copy_global_to(guild=guild)
            await bot.tree.sync(guild=guild)
            print(f"تمت مزامنة أوامر السلاش فوراً في سيرفر: {guild.name}")
        except Exception as e:
            print(f"خطأ مزامنة السيرفر {guild.name}: {e}")
    try:
        await bot.tree.sync()
    except Exception as e:
        print(f"فشلت المزامنة العامة: {e}")

    await bot.change_presence(
        activity=discord.Activity(
            type=discord.ActivityType.watching,
            name="حاسبة بطولات مزاين 🐪"
        )
    )


# ------------------------------------------------------------------ #
# Web Portal Link View (لوحة الدخول المباشر للموقع الإلكتروني)         #
# ------------------------------------------------------------------ #

class WebPortalView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(
            ui.Button(
                label="🌐 الدخول إلى منصة مزاين الإلكترونية",
                style=discord.ButtonStyle.link,
                url="http://168.119.170.236",
                emoji="🚀"
            )
        )


@bot.tree.command(name="تثبيت_لوحة_الموقع", description="إرسال لوحة وبانر الدخول المباشر إلى المنصة الإلكترونية")
async def setup_web_panel_slash(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🐪 بوابة منصة مزاين الإلكترونية",
        description=(
            "أهلاً بك في البوابة الإلكترونية لنظام مزاين.\n\n"
            "اضغط على الزر أدناه لتسجيل الدخول بحسابك في الديسكورد.\n"
            "سيتعرف النظام تلقائياً على رتبتك وصلاحياتك (مدير / عضو) ويفتح لك لوحتك الخاصة فوراً!"
        ),
        color=0x5865F2
    )
    embed.set_thumbnail(url="https://cdn-icons-png.flaticon.com/512/3069/3069172.png")
    embed.add_field(name="🔗 رابط المنصة", value="[اضغط هنا لفتح الموقع مباشرة](http://168.119.170.236)", inline=False)
    embed.set_footer(text="منصة مزاين الذكية • مسجلة ومحمية برتب الديسكورد")
    await interaction.response.send_message(embed=embed, view=WebPortalView())


@bot.tree.command(name="تثبيت_اللوحة", description="إرسال وتثبيت لوحة التحكم التفاعلية في روم حاسبة البطولات")
async def setup_panel_slash(interaction: discord.Interaction):
    embed = discord.Embed(
        title="🐪 حاسبة بطولات مزاين — لوحة التحكم التفاعلية",
        description=(
            "مرحباً بك في نظام إدارة وحساب بطولات مزاين.\n\n"
            "**الخطوات السريعة للاستخدام:**\n"
            "1️⃣ اضغط على **🏷️ تسجيل / تعديل المنقية** لكتابة اسم منقيتك.\n"
            "2️⃣ اضغط على **🔒 فتح شات منقيتي الخاص** للدخول إلى غرفتك السرية.\n"
            "3️⃣ أرسل صور كشوفات نياقك داخل شاتك الخاص (دفعة واحدة أو ZIP).\n"
            "4️⃣ اضغط على **🚀 حساب أفضل تشكيلة للبطولة** لاستخراج النتيجة المثالية فوراً!\n\n"
            "*(ملاحظة: جميع الضغطات والشات الخاص بك لا يراها أي شخص آخر).* "
        ),
        color=0x2563EB
    )
    embed.set_thumbnail(url="https://cdn-icons-png.flaticon.com/512/3069/3069172.png")
    embed.set_footer(text="نظام مزاين الذكي لحساب التشكيلات والبطولات")

    view = MainControlView()
    await interaction.response.send_message(embed=embed, view=view)


# ------------------------------------------------------------------ #
# معالجة الصور المرفقة وملفات ZIP تلقائياً                             #
# ------------------------------------------------------------------ #

@bot.event
async def on_message(message: discord.Message):
    if message.author.bot:
        return

    content_clean = message.content.strip().lower()

    # إذا أرسل المستخدم عبارة لتثبيت لوحة الموقع المباشرة
    if content_clean in [
        "!موقع", "موقع", "/موقع", "!رابط", "رابط", "/رابط", "!الموقع", "الموقع",
        "!لوحة_الموقع", "لوحة الموقع", "/تثبيت_لوحة_الموقع"
    ]:
        embed = discord.Embed(
            title="🐪 بوابة منصة مزاين الإلكترونية",
            description=(
                "أهلاً بك في البوابة الإلكترونية لنظام مزاين.\n\n"
                "اضغط على الزر أدناه لتسجيل الدخول بحسابك في الديسكورد.\n"
                "سيتعرف النظام تلقائياً على رتبتك وصلاحياتك (مدير / عضو) ويفتح لك لوحتك الخاصة فوراً!"
            ),
            color=0x5865F2
        )
        embed.set_thumbnail(url="https://cdn-icons-png.flaticon.com/512/3069/3069172.png")
        embed.add_field(name="🔗 رابط المنصة", value="[اضغط هنا لفتح الموقع مباشرة](http://168.119.170.236)", inline=False)
        embed.set_footer(text="منصة مزاين الذكية • مسجلة ومحمية برتب الديسكورد")
        try:
            await message.channel.send(embed=embed, view=WebPortalView())
            await message.delete()
        except Exception:
            pass
        return

    # إذا أرسل المستخدم أي عبارة لتثبيت اللوحة الرئيسية
    if content_clean in [
        "/تثبيت_اللوحة", "!تثبيت_اللوحة", "تثبيت_اللوحة", "تثبيت اللوحة",
        "!panel", "!setup", "/setup", "/panel", "!لوحة", "لوحة", "!تثبيت", "/تثبيت"
    ]:
        embed = discord.Embed(
            title="🐪 حاسبة بطولات مزاين — لوحة التحكم التفاعلية",
            description=(
                "مرحباً بك في نظام إدارة وحساب بطولات مزاين.\n\n"
                "**الخطوات السريعة للاستخدام:**\n"
                "1️⃣ اضغط على **🏷️ تسجيل / تعديل المنقية** لكتابة اسم منقيتك.\n"
                "2️⃣ اضغط على **🔒 فتح شات منقيتي الخاص** للدخول إلى غرفتك السرية.\n"
                "3️⃣ أرسل صور كشوفات نياقك داخل شاتك الخاص (دفعة واحدة أو ZIP).\n"
                "4️⃣ اضغط على **🚀 حساب أفضل تشكيلة للبطولة** لاستخراج النتيجة المثالية فوراً!\n\n"
                "*(ملاحظة: جميع الضغطات والشات الخاص بك لا يراها أي شخص آخر).* "
            ),
            color=0x2563EB
        )
        embed.set_thumbnail(url="https://cdn-icons-png.flaticon.com/512/3069/3069172.png")
        embed.set_footer(text="نظام مزاين الذكي لحساب التشكيلات والبطولات")
        view = MainControlView()
        try:
            await message.channel.send(embed=embed, view=view)
            await message.delete()
        except Exception:
            pass
        return

    # استخراج ملفات الصور وملفات ZIP
    image_items = []  # list of (filename, bytes)

    for att in message.attachments:
        if att.content_type and att.content_type.startswith("image/"):
            data = await att.read()
            image_items.append((att.filename, data))
        elif att.filename.lower().endswith(".zip"):
            try:
                zip_data = await att.read()
                with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
                    for zname in zf.namelist():
                        if zname.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                            with zf.open(zname) as zfile:
                                image_items.append((zname, zfile.read()))
            except Exception as e:
                print(f"خطأ في فك ضغط ZIP: {e}")

    if not image_items:
        await bot.process_commands(message)
        return

    db = SessionLocal()
    try:
        user_id = str(message.author.id)
        stable = get_user_stable(db, user_id)

        if not stable:
            embed = discord.Embed(
                title="⚠️ لم تسجل منقيتك بعد!",
                description=f"أهلاً {message.author.mention}، لكي يتم حفظ نياقك في النظام، يرجى الضغط على زر **🏷️ تسجيل / تعديل المنقية** في اللوحة أعلاه أولاً.",
                color=0xF59E0B
            )
            try:
                await message.reply(embed=embed)
            except Exception:
                pass
            return

        try:
            processing_msg = await message.reply(f"⏳ جاري استخراج بيانات ({len(image_items)}) صورة لمنقية **{stable.name}** بالذكاء الاصطناعي...")
        except Exception:
            processing_msg = None

        total_images = len(image_items)
        sem = asyncio.Semaphore(4)
        progress_lock = asyncio.Lock()
        completed_count = 0
        saved_count = 0
        summary_lines = []

        async def process_single_image(idx: int, filename: str, img_data: bytes):
            nonlocal completed_count, saved_count
            async with sem:
                # OCR extraction runs asynchronously without blocking
                ocr_res = await extract_camel_data_from_image(img_data)
                
                number_val = ocr_res.get("number", {}).get("value") or ocr_res.get("name", {}).get("value") or f"ناقة {filename}"
                name_val = ocr_res.get("name", {}).get("value") or None
                gender_val = ocr_res.get("gender", {}).get("value") or None
                color_val = ocr_res.get("color", {}).get("value") or None
                points_val = int(ocr_res.get("points", {}).get("value")) if ocr_res.get("points", {}).get("value") else None
                spacing_val = int(ocr_res.get("spacing", {}).get("value")) if ocr_res.get("spacing", {}).get("value") else None

                attr_dict = {}
                for attr in ATTRIBUTES:
                    val = ocr_res.get(attr, {}).get("value")
                    attr_dict[attr] = int(val) if val and str(val).isdigit() else None

                is_valid = bool(ocr_res.get("validation_ok", False))
                needs_review = not is_valid or ocr_res.get("overall_status") != "green"

                # DB operations with dedicated session per image for complete concurrency safety
                thread_db = SessionLocal()
                try:
                    existing_camel = None
                    if number_val and str(number_val).strip() and not str(number_val).startswith("ناقة "):
                        existing_camel = thread_db.query(Camel).filter(
                            Camel.stable_id == stable.id,
                            Camel.number == str(number_val).strip()
                        ).first()

                    if not existing_camel and attr_dict.get("neck") is not None:
                        existing_camel = thread_db.query(Camel).filter(
                            Camel.stable_id == stable.id,
                            Camel.neck == attr_dict.get("neck"),
                            Camel.lips == attr_dict.get("lips"),
                            Camel.nose == attr_dict.get("nose"),
                            Camel.head == attr_dict.get("head"),
                            Camel.eyelashes == attr_dict.get("eyelashes"),
                            Camel.ear == attr_dict.get("ear"),
                            Camel.hump == attr_dict.get("hump")
                        ).first()

                    if existing_camel:
                        existing_camel.number = str(number_val)
                        if name_val:
                            existing_camel.name = name_val
                        if gender_val:
                            existing_camel.gender = gender_val
                        if color_val:
                            existing_camel.color = color_val
                        existing_camel.points = points_val
                        existing_camel.spacing = spacing_val
                        existing_camel.is_valid = is_valid
                        existing_camel.points_valid = is_valid
                        existing_camel.spacing_valid = is_valid
                        existing_camel.needs_review = needs_review
                        for attr, val in attr_dict.items():
                            setattr(existing_camel, attr, val)
                        thread_db.commit()
                        line = f"🔄 تحديث ناقة **#{number_val}** (موجودة مسبقاً) — نقاط: **{points_val or '—'}** | تباعد: **{spacing_val if spacing_val is not None else '—'}**"
                    else:
                        new_camel = Camel(
                            number=str(number_val),
                            name=name_val,
                            gender=gender_val,
                            color=color_val,
                            stable_id=stable.id,
                            points=points_val,
                            spacing=spacing_val,
                            is_valid=is_valid,
                            points_valid=is_valid,
                            spacing_valid=is_valid,
                            needs_review=needs_review,
                            ocr_confidence=ocr_res.get("overall_confidence", 0.0),
                            status="available",
                            **attr_dict
                        )
                        thread_db.add(new_camel)
                        thread_db.commit()
                        status_icon = "✅" if is_valid else "⚠️"
                        line = f"{status_icon} إضافة ناقة جديدة **#{number_val}** — نقاط: **{points_val or '—'}** | تباعد: **{spacing_val if spacing_val is not None else '—'}**"

                    success = True
                except Exception as e:
                    thread_db.rollback()
                    line = f"❌ صورة {idx}: تعذر الحفظ ({str(e)})"
                    success = False
                finally:
                    thread_db.close()

                async with progress_lock:
                    completed_count += 1
                    if success:
                        saved_count += 1
                    summary_lines.append(line)
                    curr_completed = completed_count

                if processing_msg and (curr_completed % 3 == 0 or curr_completed == total_images) and curr_completed < total_images:
                    try:
                        await processing_msg.edit(content=f"⚡ جاري المعالجة السريعة للنياق بالذكاء الاصطناعي... ({curr_completed}/{total_images})")
                    except Exception:
                        pass

        # تشغيل كافة الصور بشكل متزامن سريع (4 في نفس الوقت)
        tasks = [process_single_image(idx, fname, img_bytes) for idx, (fname, img_bytes) in enumerate(image_items, 1)]
        await asyncio.gather(*tasks)

        embed = discord.Embed(
            title=f"🐪 تم حفظ {saved_count} من أصل {total_images} ناقة لمنقية: {stable.name}",
            description="\n".join(summary_lines[:25]),
            color=0x16A34A if saved_count == total_images else 0xF59E0B
        )
        if len(summary_lines) > 25:
            embed.description += f"\n...و تم حفظ {len(summary_lines) - 25} نياق إضافية بنجاح."

        embed.set_footer(text="اضغط زر (🚀 حساب أفضل تشكيلة للبطولة) للحصول على التشكيلة الفائزة.")
        if processing_msg:
            try:
                await processing_msg.edit(content=None, embed=embed)
            except Exception:
                await message.channel.send(embed=embed)
        else:
            try:
                await message.channel.send(embed=embed)
            except Exception:
                pass

    finally:
        db.close()

    await bot.process_commands(message)


if __name__ == "__main__":
    if not TOKEN:
        print("\n" + "="*60)
        print("خطأ: لم يتم العثور على DISCORD_BOT_TOKEN في ملف .env")
        print("يرجى فتح ملف c:\\Users\\pc\\Desktop\\mzayn\\backend\\.env ووضع التوكن")
        print("="*60 + "\n")
    else:
        print("جاري تشغيل بوت ديسكورد...")
        bot.run(TOKEN)
